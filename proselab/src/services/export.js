/**
 * export.js - Manuscript compilation and download service for ProseLab V4
 */

export function compileManuscript(project, tree) {
  const timestamp = new Date().toLocaleDateString();
  let output = `# ${project.title || "Untitled Project"}\n`;
  if (project.core?.subtitle) output += `## ${project.core.subtitle}\n`;
  output += `> Generated via ProseLab V4 | ${timestamp}\n\n`;
  
  // 1. FRONT MATTER (Core Lock)
  output += `## 📄 CORE LOCK\n\n`;
  output += `**Genre:** ${project.core?.genre || "Not specified"}\n`;
  output += `**Target Word Count:** ${project.core?.wc || "—"}\n`;
  output += `**The Central Constraint:** ${project.core?.constraint || "—"}\n\n`;
  output += `**Theme (The Argument):**\n${project.core?.theme || "—"}\n\n`;
  output += `**The False Belief:**\n${project.core?.falseBelief || "—"}\n\n`;

  // 2. TABLE OF CONTENTS
  output += `## 📚 TABLE OF CONTENTS\n\n`;
  tree.forEach((chapter, cIdx) => {
    output += `${cIdx + 1}. [CHAPTER: ${chapter.title}](#chapter-${cIdx + 1})\n`;
  });
  output += `\n***\n\n`;

  // 3. MANUSCRIPT BODY
  tree.forEach((chapter, cIdx) => {
    const chapterNum = cIdx + 1;
    output += `<a name="chapter-${chapterNum}"></a>\n`;
    output += `## CHAPTER ${chapterNum}: ${chapter.title.toUpperCase()}\n\n`;
    
    chapter.scenes.forEach((scene, sIdx) => {
      if (scene.title && !scene.title.toLowerCase().includes("untitled")) {
        output += `### ${scene.title}\n\n`;
      }
      output += `${scene.text || "*[Empty Scene]*"}\n\n`;
      if (sIdx < chapter.scenes.length - 1) {
        output += `* * *\n\n`;
      }
    });
    output += `\n---\n\n`;
  });

  // 4. APPENDIX (Dossiers & World)
  output += `## 👤 CHARACTER DOSSIERS\n\n`;
  if (project.chars?.length > 0) {
    project.chars.forEach(c => {
      output += `### ${c.name} (${c.role.toUpperCase()})\n`;
      output += `**Function:** ${c.function || "—"}\n`;
      output += `**Wound:** ${c.wound || "—"}\n`;
      output += `**Arc:** ${c.arc || "—"}\n\n`;
    });
  } else {
    output += `*No characters defined.*\n\n`;
  }

  output += `## 🌍 WORLD RULES\n\n`;
  if (project.rules?.length > 0) {
    project.rules.forEach(r => {
      output += `- **${r.rule}** (${r.category})\n  *Cost: ${r.cost} | Limit: ${r.limit}*\n`;
    });
  } else {
    output += `*No world rules defined.*\n\n`;
  }
  
  return output;
}

export function downloadManuscript(content, filename = "manuscript.md") {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
