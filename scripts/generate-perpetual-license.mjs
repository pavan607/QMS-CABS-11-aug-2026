/**
 * Generate CABS Perpetual Software Licence as Word (.docx).
 * Usage: node scripts/generate-perpetual-license.mjs
 * Output: docs/CABS_Perpetual_Software_Licence.docx
 */
import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';

const OUT_PATH = path.join(process.cwd(), 'docs', 'CABS_Perpetual_Software_Licence.docx');
const VERSION = '1.0';
const DATE = new Date().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 } });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 } });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italic })],
  });
}
function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 80 } });
}
function bullets(items) {
  return items.map((t) => bullet(t));
}
function spacer() {
  return new Paragraph({ spacing: { after: 80 } });
}
function blankLine() {
  return new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: '_______________________________________________' })],
  });
}
function table(headers, rows) {
  const headerCells = headers.map(
    (h) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: 'D6E4F0' },
      })
  );
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) => new TableCell({ children: [new Paragraph({ text: String(cell) })] })
        ),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [new TableRow({ children: headerCells }), ...dataRows],
  });
}

const sections = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'PERPETUAL SOFTWARE LICENCE', bold: true, size: 40 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: 'CABS Quality Management System (QMS)',
        bold: true,
        size: 28,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 280 },
    children: [new TextRun({ text: 'Issued in the name of CABS', italics: true, size: 24 })],
  }),

  table(
    ['Field', 'Detail'],
    [
      ['Licence reference', 'CABS-QMS-LIC-[YYYY]-[###]'],
      ['Licence type', 'Perpetual (non-expiring)'],
      ['Document version', VERSION],
      ['Issue date', DATE],
      ['Effective date', '[Effective Date]'],
    ]
  ),

  spacer(),
  h1('Parties'),
  p(
    'This Perpetual Software Licence Agreement ("Agreement") is entered into as of the Effective Date set out above, by and between:'
  ),
  ...bullets([
    'TechFLUENT Solutions Pvt Ltd, having its registered office at [Licensor Address] ("Licensor"); and',
    'CABS, [full legal name and establishment], having its principal place of business at [Licensee Address] ("Licensee", also referred to as "CABS" throughout this Agreement).',
  ]),
  p(
    'The Licensor and the Licensee are each a "Party" and together the "Parties". This Agreement is issued in the name of CABS as the authorised end-user organisation for the Licensed Software described below.'
  ),

  h1('1. Definitions'),
  ...bullets([
    '"Licensed Software" means the CABS Quality Management System (QMS) application, including source code or deployable artefacts, database schema and migration scripts, configuration templates, documentation, and any updates expressly delivered under a written change order or support schedule referenced by this Agreement.',
    '"Documentation" means user manuals, training materials, deployment guides, and technical documentation supplied with the Licensed Software.',
    '"Authorised Users" means employees, contractors, and agents of CABS who are assigned credentials and use the Licensed Software solely for CABS business purposes.',
    '"Deployment Site" means the CABS facility(ies) and intranet environment identified in Schedule A.',
    '"Perpetual Licence" means a non-exclusive, non-transferable right to use the Licensed Software without a fixed expiry date, subject to the terms and restrictions of this Agreement.',
  ]),

  h1('2. Grant of perpetual licence'),
  p(
    'Subject to payment of applicable licence fees (if any) and compliance with this Agreement, Licensor hereby grants to CABS a Perpetual Licence to install, configure, and use the Licensed Software at the Deployment Site for internal quality-assurance and inspection-management operations, including the CABS Request for R&QA Inspection/Testing workflow (Parts I-V), notifications, reporting, printable CABS forms, and audit trail functions.'
  ),
  ...bullets([
    'The licence is perpetual: it does not terminate merely due to passage of time, provided CABS remains in compliance with this Agreement.',
    'The licence is limited to the number of concurrent or named Authorised Users stated in Schedule A, unless otherwise agreed in writing.',
    'CABS may make reasonable backup and disaster-recovery copies for internal use only.',
  ]),

  h1('3. Scope of use'),
  ...bullets([
    'Use is restricted to Authorised Users at the Deployment Site and on CABS-controlled infrastructure (on-premises servers, CABS private cloud, or air-gapped LAN as applicable).',
    'CABS may not sublicense, rent, lease, sell, or otherwise make the Licensed Software available to any third party except approved integrators bound by confidentiality and solely to support CABS operations.',
    'CABS may not remove or alter proprietary notices, licence keys, or copyright markings embedded in the Licensed Software or Documentation.',
    'Reverse engineering, decompilation, or disassembly is permitted only to the extent required by applicable law and only after giving Licensor prior written notice.',
  ]),

  h1('4. Ownership and intellectual property'),
  p(
    'Licensor retains all right, title, and interest in and to the Licensed Software, Documentation, and all related intellectual property. No ownership rights are transferred to CABS under this Agreement. CABS owns its operational data entered into the Licensed Software, subject to applicable government or organisational data policies.'
  ),

  h1('5. Delivery and acceptance'),
  table(
    ['Milestone', 'Description', 'Target date', 'Sign-off'],
    [
      ['D1', 'Delivery of Licensed Software and Documentation', '[Date]', ''],
      ['D2', 'Installation at Deployment Site', '[Date]', ''],
      ['D3', 'User Acceptance Testing (UAT) complete', '[Date]', ''],
      ['D4', 'Licence activation / go-live', '[Date]', ''],
    ]
  ),
  p(
    'Acceptance occurs when CABS confirms in writing that the Licensed Software substantially conforms to the agreed specification, or thirty (30) days after delivery if no material non-conformance is reported in writing.'
  ),

  h1('6. Support and maintenance (optional)'),
  p(
    'Unless a separate Annual Maintenance Contract (AMC) or Support Agreement is executed, perpetual use rights under this Agreement do not obligate Licensor to provide updates, patches, or telephone support beyond any initial warranty period stated in Schedule B.'
  ),

  h1('7. Confidentiality'),
  p(
    'Each Party shall protect the other\'s confidential information with at least the same degree of care it uses for its own confidential information, and shall use it only to perform obligations under this Agreement. This obligation survives termination for five (5) years, except for information that becomes public through no fault of the receiving Party.'
  ),

  h1('8. Warranty and disclaimer'),
  ...bullets([
    'For [90] days from acceptance, Licensor warrants that the Licensed Software will perform substantially in accordance with the Documentation when used on supported platforms listed in the deployment guide.',
    'EXCEPT AS STATED ABOVE, THE LICENSED SOFTWARE IS PROVIDED "AS IS". LICENSOR DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.',
  ]),

  h1('9. Limitation of liability'),
  p(
    'To the maximum extent permitted by law, neither Party shall be liable for indirect, incidental, special, or consequential damages. Licensor\'s aggregate liability under this Agreement shall not exceed the total licence fees paid by CABS in the twelve (12) months preceding the claim, or [INR amount / fee cap], whichever is greater, except for liability arising from wilful misconduct or breach of confidentiality.'
  ),

  h1('10. Termination'),
  ...bullets([
    'This Perpetual Licence continues until terminated as set out in this section.',
    'Either Party may terminate for material breach if the breach is not cured within thirty (30) days of written notice.',
    'Upon termination for breach by CABS, CABS shall cease use, destroy or return copies of the Licensed Software, and certify destruction in writing, except for archival copies required by law or audit.',
    'Sections relating to ownership, confidentiality, warranty disclaimer, limitation of liability, and governing law survive termination.',
  ]),

  h1('11. Audit'),
  p(
    'CABS may audit its own use for compliance. Licensor may, upon reasonable notice and no more than once per year, audit deployment records solely to verify licence user counts and authorised Deployment Sites, subject to CABS security and access policies.'
  ),

  h1('12. Governing law and disputes'),
  p(
    'This Agreement shall be governed by the laws of India. Disputes shall be resolved by good-faith negotiation; failing agreement within thirty (30) days, disputes shall be referred to arbitration at [City] in accordance with the Arbitration and Conciliation Act, 1996, or to the courts of [Jurisdiction] where arbitration is not permitted by policy.'
  ),

  h1('13. General'),
  ...bullets([
    'Amendments must be in writing and signed by authorised representatives of both Parties.',
    'This Agreement constitutes the entire agreement regarding the Perpetual Licence and supersedes prior oral or written understandings on the same subject.',
    'If any provision is held invalid, the remainder remains in effect.',
    'Notices shall be sent to the addresses in Schedule A by registered post or official email.',
  ]),

  h1('Schedule A - Licence particulars'),
  table(
    ['Item', 'Value'],
    [
      ['Licensee (issued to)', 'CABS - [establishment / unit name]'],
      ['Licensor', 'TechFLUENT Solutions Pvt Ltd'],
      ['Licensed product', 'CABS Quality Management System (QMS)'],
      ['Product version', '[e.g. 1.0 / release tag]'],
      ['Deployment Site', '[Facility / network description]'],
      ['Authorised Users', '[Number] named / [Number] concurrent'],
      ['Licence fee (if applicable)', '[Amount] - [Paid / Waived / As per PO]'],
      ['Purchase order / contract ref.', '[PO / Contract number]'],
      ['CABS notice address', '[Address, email]'],
      ['Licensor notice address', '[Address, email]'],
    ]
  ),

  h1('Schedule B - Warranty and support (optional)'),
  table(
    ['Item', 'Value'],
    [
      ['Initial warranty period', '[90] days from acceptance'],
      ['Supported platforms', 'As per QMS Deployment and Configuration Guide'],
      ['AMC / support reference', '[Separate agreement no. or N/A]'],
    ]
  ),

  spacer(),
  h2('Authorised signatures'),
  p('IN WITNESS WHEREOF, the Parties have executed this Perpetual Software Licence as of the Effective Date.'),
  spacer(),

  new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: 'For and on behalf of CABS (Licensee)', bold: true })],
  }),
  blankLine(),
  p('Name: _________________________________'),
  p('Designation: ___________________________'),
  p('Date: __________________________________'),
  p('Official seal / stamp: __________________'),
  spacer(),

  new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: 'For and on behalf of TechFLUENT Solutions Pvt Ltd (Licensor)', bold: true })],
  }),
  blankLine(),
  p('Name: _________________________________'),
  p('Designation: ___________________________'),
  p('Date: __________________________________'),

  spacer(),
  p(`Document template version ${VERSION}. Generated ${DATE}. Regenerate: npm run docs:license`, {
    italic: true,
  }),
];

const doc = new Document({
  title: 'CABS Perpetual Software Licence - QMS',
  subject: 'Perpetual software licence issued in the name of CABS',
  creator: 'QMS',
  description: 'Perpetual licence format for CABS Quality Management System',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
  },
  sections: [{ properties: {}, children: sections }],
});

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT_PATH, buffer);
  console.log(`Written: ${OUT_PATH}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
