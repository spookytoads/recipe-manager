import type { Recipe } from '../types'
import { NUTRITION_FIELDS } from '../types'
import { formatMeasure, formatQuantity, proteinLabel, sourceLabel } from './util'

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Group ingredients by their optional component group (e.g. "Sauce"), preserving order. */
function groupIngredients(recipe: Recipe): { group: string | null; items: Recipe['ingredients'] }[] {
  const order: (string | null)[] = []
  const map = new Map<string | null, Recipe['ingredients']>()
  for (const ing of recipe.ingredients) {
    const g = (ing as { group?: string }).group?.trim() || null
    if (!map.has(g)) {
      map.set(g, [])
      order.push(g)
    }
    map.get(g)!.push(ing)
  }
  return order.map((g) => ({ group: g, items: map.get(g)! }))
}

/**
 * Open a print-ready view of a recipe in a new window and trigger the browser's
 * print dialog, so it can be saved or shared as a PDF. Returns false if a popup
 * blocker prevented the window from opening.
 */
export function exportRecipePdf(recipe: Recipe): boolean {
  const nut = recipe.nutrition
  const nutRow =
    nut &&
    NUTRITION_FIELDS.filter((f) => typeof nut[f.key] === 'number')
      .map(
        (f) =>
          `<div class="n"><b>${formatQuantity(nut[f.key] as number)}${
            f.unit ? `<i>${f.unit}</i>` : ''
          }</b><span>${esc(f.label)}</span></div>`
      )
      .join('')

  const ingHtml = groupIngredients(recipe)
    .map(({ group, items }) => {
      const rows = items
        .map(
          (i) =>
            `<li><span>${esc(i.name)}</span><em>${esc(
              formatMeasure(i.quantity, i.unit, i.altQuantity, i.altUnit)
            )}</em></li>`
        )
        .join('')
      return `${group ? `<h4>${esc(group)}</h4>` : ''}<ul class="ing">${rows}</ul>`
    })
    .join('')

  const stepsHtml = recipe.steps.map((s) => `<li>${esc(s.instruction)}</li>`).join('')
  const tagsHtml = recipe.protein.map((p) => `<span class="tag">${esc(proteinLabel(p))}</span>`).join('')

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(recipe.title)}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1f1d2e; line-height: 1.5; }
  .meta, .ing em, .src, .n span, .tag, h2, h3 { font-family: 'Helvetica Neue', Arial, sans-serif; }
  h1 { font-size: 28px; margin: 0 0 4px; color: #2C20D4; }
  .cuisine { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #6b66a8; margin-bottom: 12px; }
  .meta { font-size: 12px; color: #4a4670; display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 14px; }
  .tags { margin-bottom: 16px; }
  .tag { display: inline-block; font-size: 11px; font-weight: 600; color: #2a2540; background: #BDCF4F; border-radius: 4px; padding: 2px 9px; margin-right: 6px; }
  .nut { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; }
  .n { border: 1px solid #e3e0ef; border-radius: 8px; padding: 6px 12px; text-align: center; min-width: 64px; }
  .n b { display: block; font-family: Georgia, serif; font-size: 16px; color: #221A7A; }
  .n b i { font-style: normal; font-size: 10px; color: #8983C0; }
  .n span { display: block; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; color: #8983C0; }
  h2 { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #FF5E33; margin: 22px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  h4 { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #2C20D4; margin: 12px 0 4px; }
  ul.ing { list-style: none; margin: 0; padding: 0; }
  ul.ing li { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px dotted #e7e5f2; }
  ul.ing em { font-style: normal; font-size: 12px; color: #5A52A0; white-space: nowrap; }
  ol.steps { margin: 0; padding-left: 20px; }
  ol.steps li { margin-bottom: 9px; }
  .src { margin-top: 26px; font-size: 11px; color: #9c98bb; border-top: 1px solid #eee; padding-top: 8px; }
</style></head><body>
  <div class="cuisine">${esc(recipe.cuisine)}</div>
  <h1>${esc(recipe.title)}</h1>
  <div class="meta">
    <span>Prep ${esc(recipe.prepTime)}</span><span>Cook ${esc(recipe.cookTime)}</span>
    <span>Serves ${recipe.servings}${recipe.servingSize ? ` · ${esc(recipe.servingSize)}` : ''}</span>
  </div>
  ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
  ${nutRow ? `<div class="nut">${nutRow}</div>` : ''}
  <h2>Ingredients</h2>
  ${ingHtml}
  <h2>Instructions</h2>
  <ol class="steps">${stepsHtml}</ol>
  <div class="src">From ${esc(sourceLabel(recipe.sourceFile))} · shared from Recipe Manager</div>
  <script>window.onload=function(){setTimeout(function(){window.focus();window.print();},150);};</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
