// Question-style section heading: a bold h2 with an optional info tooltip, plus a one-line
// descriptive subtitle. Each dashboard section is introduced by one of these.
export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h2 className="mb-2 text-lg font-bold text-gray-900">{title}</h2>
      {subtitle ? <p className="mb-4 text-sm text-gray-500">{subtitle}</p> : null}
    </>
  );
}
