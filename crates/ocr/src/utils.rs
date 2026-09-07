use calamine::{Reader, Xlsx, open_workbook_from_rs};
use csv::ReaderBuilder;
use lopdf::Document;
use std::io::Cursor;

pub fn split_pdf(data: &[u8]) -> Result<Vec<Vec<u8>>, anyhow::Error> {
    let doc = Document::load_mem(data)
        .map_err(|e| anyhow::anyhow!("Failed to load PDF for splitting: {}", e))?;

    let page_numbers: Vec<u32> = doc.get_pages().keys().cloned().collect();
    if page_numbers.len() <= 1 {
        return Ok(vec![data.to_vec()]);
    }

    let mut result = Vec::with_capacity(page_numbers.len());

    for &page_num in &page_numbers {
        let mut single_page_doc = doc.clone();

        let pages_to_delete: Vec<u32> = page_numbers
            .iter()
            .filter(|&&p| p != page_num)
            .cloned()
            .collect();

        single_page_doc.delete_pages(&pages_to_delete);

        let mut buffer = Vec::new();
        single_page_doc.save_to(&mut buffer).map_err(|e| {
            anyhow::anyhow!("Failed to save split PDF for page {}: {}", page_num, e)
        })?;

        result.push(buffer);
    }

    Ok(result)
}

pub fn get_media_type(filename: &str) -> &'static str {
    let ext = filename.split('.').next_back().unwrap_or("");
    if ext.eq_ignore_ascii_case("pdf") {
        "application/pdf"
    } else if ext.eq_ignore_ascii_case("csv") {
        "text/csv"
    } else if ext.eq_ignore_ascii_case("xlsx") {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    } else if ext.eq_ignore_ascii_case("xls") {
        "application/vnd.ms-excel"
    } else if ext.eq_ignore_ascii_case("webp") {
        "image/webp"
    } else if ext.eq_ignore_ascii_case("png") {
        "image/png"
    } else if ext.eq_ignore_ascii_case("jpg") || ext.eq_ignore_ascii_case("jpeg") {
        "image/jpeg"
    } else {
        "image/png"
    }
}

pub async fn extract_pdf_text(data: &[u8]) -> Result<String, anyhow::Error> {
    let owned = data.to_vec();
    tokio::task::spawn_blocking(move || {
        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join(format!("temp_{}.pdf", uuid::Uuid::new_v4()));
        std::fs::write(&temp_path, &owned)
            .map_err(|e| anyhow::anyhow!("Failed to write temporary PDF file: {}", e))?;

        let text = pdf_extract::extract_text(&temp_path)
            .map_err(|e| anyhow::anyhow!("Failed to extract text from PDF: {}", e));

        let _ = std::fs::remove_file(&temp_path);
        text
    })
    .await
    .map_err(|e| anyhow::anyhow!("PDF extraction task panicked: {}", e))?
}

pub fn parse_csv(data: &[u8]) -> Result<String, anyhow::Error> {
    let mut reader = ReaderBuilder::new().has_headers(true).from_reader(data);

    let mut result = String::new();
    for (i, record) in reader.records().enumerate() {
        let record =
            record.map_err(|e| anyhow::anyhow!("CSV parsing error at row {}: {}", i + 1, e))?;
        result.push_str(&record.iter().collect::<Vec<_>>().join(", "));
        result.push('\n');
    }

    if result.is_empty() {
        return Err(anyhow::anyhow!("CSV file is empty or has no valid rows"));
    }

    Ok(result)
}

pub fn parse_excel(data: &[u8]) -> Result<String, anyhow::Error> {
    let cursor = Cursor::new(data);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| anyhow::anyhow!("Failed to open Excel workbook: {}", e))?;

    let mut result = String::new();
    if let Some(res) = workbook.worksheet_range_at(0) {
        let range = res.map_err(|e| anyhow::anyhow!("Failed to read Excel worksheet: {}", e))?;
        for row in range.rows() {
            result.push_str(
                &row.iter()
                    .map(|c| c.to_string())
                    .collect::<Vec<_>>()
                    .join(", "),
            );
            result.push('\n');
        }
    }

    if result.is_empty() {
        return Err(anyhow::anyhow!(
            "Excel worksheet is empty or could not be read"
        ));
    }

    Ok(result)
}

pub fn parse_bank_date(date_str: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    let formats = [
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%d-%b-%Y",
        "%d %b %Y",
        "%m/%d/%Y",
        "%b %d, %Y",
    ];
    for fmt in formats {
        if let Ok(dt) = chrono::NaiveDate::parse_from_str(date_str, fmt) {
            return Some(chrono::DateTime::from_naive_utc_and_offset(
                dt.and_hms_opt(0, 0, 0)?,
                chrono::Utc,
            ));
        }
    }
    tracing::error!("❌ Failed to parse bank transaction date: '{}'", date_str);
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{Document, Object, Stream, dictionary};

    fn create_dummy_pdf(pages: usize) -> Vec<u8> {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();

        let font_id = doc.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });

        let resources_id = doc.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });

        let mut kids = Vec::new();

        for i in 0..pages {
            let content_str = format!("BT /F1 12 Tf 100 100 Td (Page {}) Tj ET", i + 1);
            let content =
                doc.add_object(Stream::new(dictionary! {}, content_str.as_bytes().to_vec()));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content,
                "Resources" => resources_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            });
            kids.push(page_id.into());
        }

        let pages_dict = dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => pages as i32,
        };

        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });

        doc.trailer.set("Root", catalog_id);

        let mut out = Vec::new();
        doc.save_to(&mut out).unwrap();
        out
    }

    #[test]
    fn test_split_pdf() {
        let pdf_data = create_dummy_pdf(3);

        let split_result = split_pdf(&pdf_data).expect("Failed to split PDF");
        assert_eq!(split_result.len(), 3, "Should have 3 pages");

        for (i, page_data) in split_result.iter().enumerate() {
            let parsed_doc = Document::load_mem(page_data)
                .unwrap_or_else(|_| panic!("Failed to parse split page {}", i + 1));
            assert_eq!(
                parsed_doc.get_pages().len(),
                1,
                "Split page should contain exactly 1 page"
            );
        }
    }

    #[test]
    fn test_split_pdf_single_page() {
        let pdf_data = create_dummy_pdf(1);
        let split_result = split_pdf(&pdf_data).expect("Failed to split PDF");
        assert_eq!(split_result.len(), 1, "Should have 1 page");
    }
}
