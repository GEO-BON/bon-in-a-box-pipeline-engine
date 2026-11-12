/**
 * Code adapted from https://github.com/marudhupandiyang/react-csv-to-table
 * For some reason NPM would not install this dependency.
 */

export function parseCsvToRowsAndColumn(csvText, csvColumnDelimiter = '\t') {
    const rows = csvText.split('\n');
    if (!rows || rows.length === 0) {
        return [];
    }

    return rows.map(row => {
      const splitRow = parseDelimitedRow(row, csvColumnDelimiter);
      if(splitRow && splitRow.length > 0){
        return splitRow.map(cell => cell.trim()).map(cell => cell.replace(/^"(.*)"$/, '$1'));
      }
      return splitRow;
    });
}

function parseDelimitedRow(row, delimiter) {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (char === '"') {
            insideQuotes = !insideQuotes;
            current += char;
        } else if (char === delimiter && !insideQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}


const CsvToHtmlTable = ({
  data,
  csvDelimiter = '\t',
  hasHeader = true,
  tableClassName = '',
  tableRowClassName = '',
  tableColumnClassName = '',
  rowKey = (row, rowIdx) => `row-${rowIdx}`,
  colKey = (col, colIdx, rowIdx) => `col-${colIdx}`,
  renderCell = (col, colIdx, rowIdx) => col,
}) => {
  const rowsWithColumns = parseCsvToRowsAndColumn(data.trimEnd(), csvDelimiter);
  let headerRow = undefined;
  if (hasHeader) {
    headerRow = rowsWithColumns.splice(0, 1)[0];
  }

  const renderTableHeader = (row) => {
    if (row && row.map) {
      return (
        <thead>
          <tr>
            {
              row.map((column, i) => (
                <th key={`header-${i}`}>
                  {column}
                </th>
              ))
            }
          </tr>
        </thead>
      );
    }
  };

  const renderTableBody = (rows) => {
    if (rows && rows.map) {
      return (
        <tbody>
          {
            rows.map((row, rowIdx) => (
              <tr className={tableRowClassName} key={rowKey(row, rowIdx)}>
                {
                  row.map && row.map((column, colIdx) => (
                    <td
                      className={tableColumnClassName}
                      key={colKey(row, colIdx, rowIdx)}
                    >
                      {renderCell(column, colIdx, rowIdx)}
                    </td>
                  ))
                }
              </tr>
            ))
          }
        </tbody>
      );
    }
  };

  return (
    <table className={`csv-html-table ${tableClassName}`}>
      {renderTableHeader(headerRow)}
      {renderTableBody(rowsWithColumns)}
    </table>
  );
};

export default CsvToHtmlTable;