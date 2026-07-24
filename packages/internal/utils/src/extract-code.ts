/**
 * Extract plain code text from a rendered HTML string.
 *
 * Feed content wraps code blocks in a variety of shapes (Hugo, Shiki, Hexo,
 * plain `<pre><code>`…). This normalizes those into a newline-delimited string
 * suitable for re-highlighting. DOM-based, so it must run in a browser/webview
 * (or a DOM-like test environment such as happy-dom).
 */
export function extractCodeFromHtml(htmlString: string) {
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = htmlString

  const hasPre = tempDiv.querySelector("pre")
  if (!hasPre) {
    tempDiv.innerHTML = `<pre><code>${htmlString}</code></pre>`
  }

  // 1. line break via <div />
  const divElements = tempDiv.querySelectorAll("div")

  let code = ""

  if (divElements.length > 0) {
    divElements.forEach((div) => {
      code += `${div.textContent}\n`
    })
    return code
  }

  // 2. line wrapper like <span><span>...</span></span>
  const spanElements = tempDiv.querySelectorAll("span > span")

  // 2.1 outside <span /> as a line break?

  let spanAsLineBreak = false

  if (tempDiv.children.length > 2) {
    for (const node of tempDiv.children) {
      const span = node as HTMLSpanElement
      // 2.2 If the span has only one child and it's a line break, then span can be as a line break
      spanAsLineBreak = span.children.length === 1 && span.childNodes.item(0).textContent === "\n"
      if (spanAsLineBreak) break
    }
  }

  if (!spanAsLineBreak) {
    const usingBr = tempDiv.querySelector("br")
    if (usingBr) {
      spanAsLineBreak = true
    }
  }

  if (spanElements.length > 0) {
    for (const node of tempDiv.children) {
      if (spanAsLineBreak) {
        code += `${node.textContent}`
      } else {
        code += `${node.textContent}\n`
      }
    }

    return code
  }

  return tempDiv.textContent
}
