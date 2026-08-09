use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse_csv_to_json(data: &[u8]) -> Result<JsValue, JsError> {
    use csv::ReaderBuilder;
    let mut reader = ReaderBuilder::new().has_headers(true).from_reader(data);

    let mut rows = Vec::new();
    let headers = reader.headers()?.clone();

    for result in reader.records() {
        let record = result?;
        let mut row = std::collections::HashMap::new();
        for (i, header) in headers.iter().enumerate() {
            if let Some(val) = record.get(i) {
                row.insert(header, val.to_owned());
            }
        }
        rows.push(row);
    }

    serde_wasm_bindgen::to_value(&rows).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen]
pub fn parse_excel_to_json(data: &[u8]) -> Result<JsValue, JsError> {
    use calamine::{Reader, Xlsx, open_workbook_from_rs};
    use std::io::Cursor;

    let cursor = Cursor::new(data);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| JsError::new(&format!("Failed to open Excel: {}", e)))?;

    let mut rows = Vec::new();
    if let Some(res) = workbook.worksheet_range_at(0) {
        let range = res.map_err(|e| JsError::new(&format!("Failed to read Sheet: {}", e)))?;

        let mut headers = Vec::new();
        for (i, row) in range.rows().enumerate() {
            if i == 0 {
                headers = row.iter().map(|c| c.to_string()).collect();
                continue;
            }

            let mut row_map = std::collections::HashMap::new();
            for (j, cell) in row.iter().enumerate() {
                if let Some(header) = headers.get(j) {
                    row_map.insert(header.clone(), cell.to_string());
                }
            }
            rows.push(row_map);
        }
    }

    serde_wasm_bindgen::to_value(&rows).map_err(|e| JsError::new(&e.to_string()))
}
