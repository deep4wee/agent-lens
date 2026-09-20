const fs = require('fs');
const path = require('path');

// When installed via npm, INIT_CWD is the root of the project installing this package.
// If not available, fallback to process.cwd() (though usually that's the package dir itself).
const targetProjectRoot = process.env.INIT_CWD || process.cwd();

const skillSourceDir = path.join(__dirname, '../skills/agent-lens');
const targetSkillDir = path.join(targetProjectRoot, '.agents', 'skills', 'agent-lens');

function copySkillRecursive(src, dest) {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copySkillRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copySkill() {
  try {
    if (!fs.existsSync(skillSourceDir)) {
      return;
    }

    copySkillRecursive(skillSourceDir, targetSkillDir);
    console.log(`[AgentLens] Successfully equipped AI skill at ${targetSkillDir}`);
  } catch (error) {
    console.warn('[AgentLens] Warning: Failed to copy SKILL.md automatically:', error.message);
  }
}

// Don't run postinstall if we are developing inside the agent-lens repo itself
if (path.resolve(targetProjectRoot) !== path.resolve(path.join(__dirname, '..'))) {
  copySkill();
}
