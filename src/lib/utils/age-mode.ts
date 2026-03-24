export type AgeMode = "elementary" | "middle" | "high";

export function deriveAgeMode(birthYear: number): AgeMode {
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  if (age <= 10) return "elementary";
  if (age <= 14) return "middle";
  return "high";
}
