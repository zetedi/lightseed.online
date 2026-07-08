import { BEING_NOTE, DATA_MODEL, DATA_RELATIONS, type ModelEntity } from '../domain/dataModel';

// Emit the data model as draw.io (mxGraph) XML — importable/editable at diagrams.net. Each entity
// is an HTML-labelled box; each relationship is an edge labelled with the field that forms it.

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ROW = 22;
const HEADER = 46;
const WIDTH = 250;

const boxHeight = (e: ModelEntity) => HEADER + e.fields.length * ROW + 8;

// The HTML label for an entity box (rendered by draw.io with html=1).
const entityLabelHtml = (e: ModelEntity) => {
  const rows = e.fields.map(f => {
    const key = f.pk ? `<b>${f.name}</b>` : f.name;
    const rhs = f.ref ? `${f.type} → ${f.ref}` : f.type;
    return `<div style="text-align:left;padding:1px 8px;">${key} : <span style="color:#64748b;">${rhs}</span></div>`;
  }).join('');
  const note = e.note ? `<div style="font-size:9px;color:#94a3b8;padding:2px 8px 4px;text-align:left;">${e.note}</div>` : '';
  return `<div style="text-align:left;"><div style="background:#065f46;color:#ecfdf5;font-weight:bold;padding:5px 8px;border-radius:6px 6px 0 0;">${e.label} <span style="font-weight:normal;color:#a7f3d0;font-size:10px;">${e.collection}</span></div>${note}${rows}</div>`;
};

export const buildDrawioXml = (): string => {
  const cells: string[] = [
    '<mxCell id="0" />',
    '<mxCell id="1" parent="0" />',
  ];

  for (const e of DATA_MODEL) {
    const style = 'rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;fillColor=#0f172a;strokeColor=#10b981;fontColor=#e2e8f0;fontSize=11;arcSize=6;';
    cells.push(
      `<mxCell id="${e.key}" value="${xmlEscape(entityLabelHtml(e))}" style="${style}" vertex="1" parent="1">` +
      `<mxGeometry x="${e.x}" y="${e.y}" width="${WIDTH}" height="${boxHeight(e)}" as="geometry" /></mxCell>`
    );
  }

  // The concept note — a free-standing text cell above the leftmost column.
  cells.push(
    `<mxCell id="beingNote" value="${xmlEscape(BEING_NOTE)}" ` +
    'style="text;html=1;align=left;verticalAlign=middle;fontStyle=2;fontSize=11;fontColor=#6ee7b7;" ' +
    'vertex="1" parent="1"><mxGeometry x="40" y="0" width="640" height="30" as="geometry" /></mxCell>'
  );

  DATA_RELATIONS.forEach((r, i) => {
    const style = r.lin
      ? 'endArrow=open;html=1;dashed=1;strokeColor=#f59e0b;fontColor=#f59e0b;fontSize=10;curved=1;'
      : 'endArrow=block;html=1;strokeColor=#38bdf8;fontColor=#7dd3fc;fontSize=10;curved=1;';
    cells.push(
      `<mxCell id="e${i}" value="${xmlEscape(r.label + (r.many ? ' []' : ''))}" style="${style}" edge="1" parent="1" source="${r.from}" target="${r.to}">` +
      `<mxGeometry relative="1" as="geometry" /></mxCell>`
    );
  });

  return `<mxGraphModel dx="1024" dy="768" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="900" math="0" shadow="0">
  <root>
    ${cells.join('\n    ')}
  </root>
</mxGraphModel>`;
};

// draw.io accepts a bare <mxGraphModel> or the <mxfile> wrapper; the wrapper opens cleaner.
export const buildDrawioFile = (): string =>
  `<mxfile host="lifeseed" type="device"><diagram name="Data model">${buildDrawioXml()}</diagram></mxfile>`;
