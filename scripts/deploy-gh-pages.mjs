import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

function run(cmd, cwd = process.cwd()) {
  console.log(`Running: ${cmd} in ${cwd}`);
  return execSync(cmd, { cwd, stdio: "inherit" });
}

const headCommit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const tempWorktree = path.join(os.tmpdir(), "gh-pages-deploy-" + Date.now());
const deployDesc = process.argv[2] || "단체 채팅방 회원 분류 및 정렬 배포";

try {
  // Ensure local gh-pages branch matches remote origin/gh-pages
  try {
    run("git fetch origin gh-pages");
    run("git branch -f gh-pages origin/gh-pages");
  } catch (e) {
    console.warn("Could not sync local gh-pages branch with origin, continuing:", e.message);
  }

  run(`git worktree add "${tempWorktree}" gh-pages`);
  
  // Clean old files in tempWorktree except .git
  const files = fs.readdirSync(tempWorktree);
  for (const f of files) {
    if (f === ".git") continue;
    fs.rmSync(path.join(tempWorktree, f), { recursive: true, force: true });
  }

  // Copy out directory into tempWorktree
  const outDir = path.resolve("out");
  if (!fs.existsSync(outDir)) {
    throw new Error("out directory does not exist! Please run build with GITHUB_PAGES=true first.");
  }
  fs.cpSync(outDir, tempWorktree, { recursive: true });

  // Ensure .nojekyll exists for GitHub Pages to serve _next assets
  fs.writeFileSync(path.join(tempWorktree, ".nojekyll"), "");

  // Commit and push
  run("git add -A", tempWorktree);
  run(`git commit -m "deploy: ${headCommit} (${deployDesc})"`, tempWorktree);
  run("git push origin gh-pages", tempWorktree);
  console.log("Successfully pushed to gh-pages!");
} finally {
  try {
    run(`git worktree remove "${tempWorktree}" --force`);
  } catch (e) {
    console.warn("Worktree cleanup warning:", e.message);
  }
}
