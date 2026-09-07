import { toast } from "@keiri/ui/components/goey-toaster";
import { useCallback, useState } from "react";

export interface UseEntityFormOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
  validate?: (values: T) => string | null;
}

export function useEntityForm<T>({ initialValues, onSubmit, validate }: UseEntityFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((name: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value as T[keyof T] }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (validate) {
      const error = validate(values);
      if (error) {
        toast.error(error);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit(values);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error?.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    isSubmitting,
    handleChange,
    handleSubmit,
    reset,
  };
}
