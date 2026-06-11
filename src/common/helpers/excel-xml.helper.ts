type CellValue = string | number | boolean | Date | null | undefined;

type Worksheet = {
  name: string;
  rows: CellValue[][];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeCellValue(value: CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function buildTable(rows: CellValue[][]): string {
  return rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value) => {
          const normalized = normalizeCellValue(value);
          return `<Cell><Data ss:Type="String">${escapeXml(normalized)}</Data></Cell>`;
        })
        .join('');

      const style = rowIndex === 0 ? ' ss:StyleID="Header"' : '';
      return `<Row${style}>${cells}</Row>`;
    })
    .join('');
}

export function buildExcelXmlWorkbook(worksheets: Worksheet[]): string {
  const sheetXml = worksheets
    .map(
      (worksheet) => `
        <Worksheet ss:Name="${escapeXml(worksheet.name)}">
          <Table>
            ${buildTable(worksheet.rows)}
          </Table>
        </Worksheet>`,
    )
    .join('');

  return `<?xml version="1.0"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook
      xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:html="http://www.w3.org/TR/REC-html40">
      <Styles>
        <Style ss:ID="Header">
          <Font ss:Bold="1"/>
          <Interior ss:Color="#EAF2F8" ss:Pattern="Solid"/>
        </Style>
      </Styles>
      ${sheetXml}
    </Workbook>`;
}
