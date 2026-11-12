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

try {
  run(`git worktree add "${tempWorktree}" gh-pages`);
  
  // Clean old files in tempWorktree except .git
  const files = fs.readdirSync(tempWorktree);
  for (const f of files) {
    if (f === ".git") continue;
    fs.rmSync(path.join(tempWorktree, f), { recursive: true, force: true });
  }

  // Copy out directory into tempWorktree
  const outDir = path.resolve("out");
  fs.cpSync(outDir, tempWorktree, { recursive: true });

  // Commit and push
  run("git add -A", tempWorktree);
  run(`git commit -m "deploy: ${headCommit} (채팅방 최신 메시지순 정렬 배포)"`, tempWorktree);
  run("git push origin gh-pages", tempWorktree);
  console.log("Successfully pushed to gh-pages!");
} finally {
  try {
    run(`git worktree remove "${tempWorktree}" --force`);
  } catch (e) {
    console.warn("Worktree cleanup warning:", e.message);
  }
}
