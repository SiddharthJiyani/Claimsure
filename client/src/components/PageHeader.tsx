export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow ? <p className="cs-kicker">{eyebrow}</p> : null}
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function WorkspaceFrame({
  children,
  width = "wide",
}: {
  children: React.ReactNode;
  width?: "wide" | "medium" | "narrow";
}) {
  const max =
    width === "narrow"
      ? "max-w-3xl"
      : width === "medium"
        ? "max-w-4xl"
        : "max-w-6xl";
  return <div className={`mx-auto w-full space-y-7 ${max}`}>{children}</div>;
}
