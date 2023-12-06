export function handleHN(
  page: { html: string; textContent: string },
  metaObject: Record<string, string | Object>,
) {
  metaObject["detectedType"] = "Hacker News";
  // Regex for Score
  const scoreRegex = /<span class="score"[^>]*>(\d+) points<\/span>/;
  const scoreMatch = page.html.match(scoreRegex);
  const score = scoreMatch ? scoreMatch[1] : null;

  // Regex for HNUser
  const userRegex = /<a href="user\?id=[^"]+" class="hnuser">([^<]+)<\/a>/;
  const userMatch = page.html.match(userRegex);
  const hnuser = userMatch ? userMatch[1] : null;

  // Regex for Titleline Href
  const articleUrlRegex = /<span class="titleline"><a href="([^"]+)"/;
  const articleUrlMatch = page.html.match(articleUrlRegex);
  const articleUrl = articleUrlMatch ? articleUrlMatch[1] : null;

  // console.log("Score:", score);
  // console.log("HNUser:", hnuser);
  // console.log("articleUrl Href:", articleUrlHref);
  metaObject["specialMeta"] = { score, hnuser, articleUrl };
}
