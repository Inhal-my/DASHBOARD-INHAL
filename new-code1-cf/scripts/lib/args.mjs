export function getArg(argv, name, fallback = '') {
  const prefix = `${name}=`;
  const inline = (argv || []).find((item) => String(item).startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = (argv || []).indexOf(name);
  if (index === -1) return fallback;
  return argv[index + 1] ?? fallback;
}
