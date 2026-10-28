export function missingPrerequisites(
  prerequisites: string[],
  records: Record<string, any>,
) {
  return prerequisites.filter((id) => !records["micro:" + id]?.completedAt);
}
