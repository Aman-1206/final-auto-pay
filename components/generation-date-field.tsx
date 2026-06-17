"use client";

import { useMemo, useState } from "react";

function getTodayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return "the selected date";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

export function GenerationDateField() {
  const todayValue = useMemo(() => getTodayValue(), []);
  const [generationDate, setGenerationDate] = useState(todayValue);
  const selectedLabel = generationDate === todayValue ? "today" : formatDateLabel(generationDate);

  return (
    <label className="field">
      <span>Generation date</span>
      <input
        name="generationDate"
        type="date"
        value={generationDate}
        onChange={(event) => setGenerationDate(event.target.value || todayValue)}
      />
      <small className="field-help">This will generate reminders for {selectedLabel}.</small>
    </label>
  );
}
