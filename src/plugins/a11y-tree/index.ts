import fs from 'fs';
import path from 'path';
import type { Page } from 'playwright';
import { definePlugin, type AgentLensPlugin } from '../../shared/api/plugin';
import { formatAccessibilityTree, type AccessibilityNode } from './formatter';

const STATE_A11Y_KEY = 'latestA11yTree';

export interface DumpA11yOptions {
  compact?: boolean;
  selector?: string;
  saveToFile?: boolean;
}

async function extractDomAccessibilityTree(page: Page, rootSelector?: string): Promise<AccessibilityNode | null> {
  return await page.evaluate((selector) => {
    function getRole(el: HTMLElement): string {
      const explicit = el.getAttribute('role');
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      if (tag === 'button') return 'button';
      if (tag === 'a' && el.hasAttribute('href')) return 'link';
      if (tag === 'input') {
        const type = (el as HTMLInputElement).type || 'text';
        if (['checkbox', 'radio'].includes(type)) return type;
        if (['button', 'submit', 'reset'].includes(type)) return 'button';
        return 'textbox';
      }
      if (tag === 'textarea') return 'textbox';
      if (tag === 'select') return 'combobox';
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
      if (tag === 'nav') return 'navigation';
      if (tag === 'main') return 'main';
      if (tag === 'header') return 'banner';
      if (tag === 'footer') return 'contentinfo';
      if (tag === 'ul' || tag === 'ol') return 'list';
      if (tag === 'li') return 'listitem';
      if (tag === 'table') return 'table';
      if (tag === 'img') return 'img';
      return '';
    }

    function getName(el: HTMLElement): string {
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      const placeholder = (el as HTMLInputElement).placeholder;
      if (placeholder) return placeholder.trim();
      const alt = el.getAttribute('alt');
      if (alt) return alt.trim();
      const tag = el.tagName.toLowerCase();
      if (['button', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        return (el.innerText || el.textContent || '').trim().slice(0, 80);
      }
      return '';
    }

    function walk(el: Element): any {
      const htmlEl = el as HTMLElement;
      if (!htmlEl || htmlEl.nodeType !== 1) return null;

      const style = window.getComputedStyle(htmlEl);
      if (style.display === 'none' || style.visibility === 'hidden') return null;

      const role = getRole(htmlEl);
      const name = getName(htmlEl);

      const children: any[] = [];
      for (const child of Array.from(htmlEl.children)) {
        const childNode = walk(child);
        if (childNode) children.push(childNode);
      }

      if (!role && !name && children.length === 0) return null;

      if (!role && !name) {
        if (children.length === 1) return children[0];
        return { role: 'group', children };
      }

      const node: any = { role: role || 'generic' };
      if (name) node.name = name;
      if (children.length > 0) node.children = children;

      if (htmlEl.tagName.startsWith('H') && htmlEl.tagName.length === 2) {
        node.level = parseInt(htmlEl.tagName[1], 10);
      }
      if ((htmlEl as any).disabled) node.disabled = true;
      if (htmlEl.hasAttribute('required')) node.required = true;
      if (document.activeElement === htmlEl) node.focused = true;

      return node;
    }

    const rootEl = selector ? document.querySelector(selector) : document.body;
    return rootEl ? walk(rootEl) : null;
  }, rootSelector);
}

export const a11yTreePlugin: AgentLensPlugin = definePlugin({
  name: 'a11y-tree',
  version: '1.0.0',

  extendContext: (_ctx, page, hookContext) => {
    return {
      dumpAccessibilityTree: async (options?: DumpA11yOptions): Promise<string> => {
        console.log(`♿ [a11y-tree] Capturing semantic accessibility tree...`);

        const rootNode = await extractDomAccessibilityTree(page, options?.selector);
        const markdown = formatAccessibilityTree(rootNode, 0, { compact: options?.compact ?? true });

        if (hookContext.artifactsDir && options?.saveToFile !== false) {
          const filePath = path.join(hookContext.artifactsDir, 'a11y-tree.md');
          fs.writeFileSync(filePath, markdown, 'utf-8');
          console.log(`♿ [a11y-tree] Dump saved to: ${filePath}`);
        }

        hookContext.state.set(STATE_A11Y_KEY, markdown);
        return markdown;
      }
    };
  },

  onAfterRun: (reportData, hookContext) => {
    const tree = hookContext.state.get(STATE_A11Y_KEY) as string | undefined;
    if (tree && reportData.customSections) {
      const truncated = tree.length > 3000 ? tree.slice(0, 3000) + '\n\n*...and more (see a11y-tree.md)*' : tree;
      reportData.customSections.push({
        title: '♿ Accessibility Semantic Tree (for Text AI Agents)',
        content: `> Clean semantic hierarchy for text models (GPT-4o-mini, Haiku, Ollama).\n\n\`\`\`markdown\n${truncated}\n\`\`\``
      });
    }
  }
});

export default a11yTreePlugin;
