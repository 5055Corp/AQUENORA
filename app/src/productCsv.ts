// Adding many products from a spreadsheet (CSV): the template, reading the file, and checking each row.
//
// Columns (any order, case doesn't matter): Name, Price, Stock, Cost price, Description, Made to order days,
// Option 1 name, Option 1 choices ... Option 7 name, Option 7 choices.
// Choices are separated by | . On the first option a choice can have its own price ("20 inch = 60000");
// on the others it can add to the price ("Blonde + 5000").
import { MAX_OPTION_GROUPS, type OptionChoice, type ProductOptions } from './options';

export interface ImportRow {
  title: string;
  price: number;
  stock?: number;
  cost_price?: number;
  description?: string;
  made_to_order_days?: number;
  options?: ProductOptions;
}

export interface CheckedRow { line: number; product: ImportRow | null; error: string }

export const MAX_IMPORT = 200;

export const TEMPLATE = [
  'Name,Price,Stock,Cost price,Description,Made to order days,Option 1 name,Option 1 choices,Option 2 name,Option 2 choices',
  'Bone straight wig,85000,4,50000,"Soft, full and ready to wear",,Length,12 inch | 20 inch = 110000,Colour,Black | Blonde + 5000',
  'Ankara tote bag,12000,10,6000,Hand-sewn in Lagos,,,,,',
  'Tailored kaftan,45000,,,Made to your measurements,7,Size,S | M | L | XL,,',
].join('\r\n') + '\r\n';

/** Reads CSV text into rows of cells (handles quotes, commas and line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  // Comma, or the semicolon/tab some spreadsheet apps use: whichever the header row uses most.
  const header = s.split(/\r?\n/, 1)[0];
  const sep = [',', ';', '\t'].reduce((a, b) => (header.split(b).length > header.split(a).length ? b : a));
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

/** "₦28,000" / "28 000" / "28000.00" → 28000; '' → undefined; junk → NaN. */
function num(v: string | undefined): number | undefined {
  const t = (v ?? '').replace(/[₦$£€,\s]|NGN|GHS|KES|ZAR|USD/gi, '').trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function choicesOf(text: string, first: boolean): OptionChoice[] | string {
  const out: OptionChoice[] = [];
  for (const part of text.split('|').map(x => x.trim()).filter(Boolean)) {
    const m = part.match(first ? /^(.*?)\s*=\s*(.+)$/ : /^(.*?)\s*\+\s*(.+)$/);
    const label = (m ? m[1] : part).trim();
    if (!label) return `a choice in "${text}" has no name`;
    if (label.length > 40) return `"${label}" is too long (40 letters at most)`;
    if (out.some(c => c.label.toLowerCase() === label.toLowerCase())) return `"${label}" is listed twice`;
    if (m) {
      const n = num(m[2]);
      if (n === undefined || Number.isNaN(n) || n < 0) return `the price for "${label}" isn't a number`;
      out.push(first ? { label, price: n } : { label, extra: n });
    } else out.push({ label });
  }
  return out.length ? out : 'no choices';
}

/** Turns the spreadsheet into products, with a plain message for each row that can't be added. */
export function checkRows(text: string): { rows: CheckedRow[]; error: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], error: 'The file is empty. Fill in the template, one product per row.' };
  const head = table[0].map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const col = (...names: string[]) => head.findIndex(h => names.includes(h));
  const at = {
    name: col('name', 'product name', 'title', 'product'),
    price: col('price', 'selling price'),
    stock: col('stock', 'quantity', 'qty', 'in stock'),
    cost: col('cost price', 'cost'),
    desc: col('description', 'details'),
    mto: col('made to order days', 'made to order'),
  };
  if (at.name < 0 || at.price < 0) return { rows: [], error: 'The first row needs the column names "Name" and "Price". Download the template to start.' };
  const rows: CheckedRow[] = [];
  for (const [i, r] of table.slice(1).entries()) {
    const line = i + 2;
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const bad = (error: string) => rows.push({ line, product: null, error });
    const title = get(at.name);
    if (!title) { bad('No name'); continue; }
    if (title.length > 120) { bad('Name is too long (120 letters at most)'); continue; }
    const price = num(get(at.price));
    if (price === undefined || Number.isNaN(price) || price < 0) { bad('Price must be a number, e.g. 28000'); continue; }
    const stock = num(get(at.stock));
    if (Number.isNaN(stock) || (stock ?? 0) < 0) { bad('Stock must be a whole number'); continue; }
    const cost = num(get(at.cost));
    if (Number.isNaN(cost) || (cost ?? 0) < 0) { bad('Cost price must be a number'); continue; }
    const mto = num(get(at.mto));
    if (Number.isNaN(mto) || (mto !== undefined && (mto < 1 || mto > 180))) { bad('Made to order days must be 1 to 180'); continue; }
    const description = get(at.desc).slice(0, 2000);

    const groups: ProductOptions['groups'] = [];
    let optError = '';
    for (let n = 1; n <= MAX_OPTION_GROUPS && !optError; n++) {
      const name = get(col(`option ${n} name`, `option ${n}`));
      const list = get(col(`option ${n} choices`, `option ${n} values`));
      if (!name && !list) continue;
      if (!name) { optError = `Option ${n} has choices but no name (e.g. Size)`; break; }
      if (!list) { optError = `Option ${n} (${name}) has no choices`; break; }
      if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) { optError = `Two options are called ${name}`; break; }
      const choices = choicesOf(list, groups.length === 0);
      if (typeof choices === 'string') { optError = `${name}: ${choices}`; break; }
      groups.push({ name: name.slice(0, 30), choices });
    }
    if (optError) { bad(optError); continue; }

    rows.push({
      line,
      error: '',
      product: {
        title,
        price,
        ...(stock !== undefined ? { stock } : {}),
        ...(cost !== undefined ? { cost_price: cost } : {}),
        ...(description ? { description } : {}),
        ...(mto ? { made_to_order_days: mto } : {}),
        ...(groups.length ? { options: { groups } } : {}),
      },
    });
  }
  if (rows.length > MAX_IMPORT) return { rows: [], error: `That's ${rows.length} products. Add up to ${MAX_IMPORT} at a time: split the file in two.` };
  return { rows, error: rows.length ? '' : 'No products found under the column names.' };
}
