export interface AccessibilityNode {
  role: string;
  name?: string;
  value?: string | number;
  description?: string;
  keyshortcuts?: string;
  roledescription?: string;
  valuetext?: string;
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  pressed?: boolean | 'mixed';
  level?: number;
  valuemin?: number;
  valuemax?: number;
  autocomplete?: string;
  haspopup?: string;
  invalid?: string;
  orientation?: string;
  children?: AccessibilityNode[];
}

/**
 * Format an accessibility tree node into clean, indented Markdown for text-based LLMs.
 */
export function formatAccessibilityTree(
  node: AccessibilityNode | null,
  depth = 0,
  options?: { compact?: boolean }
): string {
  if (!node) return '';

  const indent = '  '.repeat(depth);
  const parts: string[] = [`${indent}- role: **${node.role}**`];

  if (node.name) {
    parts.push(`"${node.name.replace(/"/g, '\\"')}"`);
  }

  const flags: string[] = [];
  if (node.level !== undefined) flags.push(`level ${node.level}`);
  if (node.disabled) flags.push('disabled');
  if (node.required) flags.push('required');
  if (node.focused) flags.push('focused');
  if (node.checked !== undefined && node.checked !== false) flags.push(`checked: ${String(node.checked)}`);
  if (node.pressed !== undefined) flags.push(`pressed: ${String(node.pressed)}`);
  if (node.selected) flags.push('selected');
  if (node.value !== undefined && node.value !== '') flags.push(`value: "${String(node.value)}"`);

  if (flags.length > 0) {
    parts.push(`[${flags.join(', ')}]`);
  }

  let result = parts.join(' ') + '\n';

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (options?.compact && !child.name && (!child.children || child.children.length === 0)) {
        continue;
      }
      result += formatAccessibilityTree(child, depth + 1, options);
    }
  }

  return result;
}
