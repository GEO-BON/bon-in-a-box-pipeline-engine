import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { TableVirtuoso } from "react-virtuoso";

export default function CustomTable({ tableData }) {

  // Remove empty rows
  const filteredData = tableData.filter(
    (row) =>
      !row.values().every((cell) => {
        cell === "";
      })
  );

  const itemContent = (index, data) => {
    if (data) {
      const headerRow = Array.from(filteredData[0].keys());
      return headerRow.map((columnHeader, i) => (
        <TableCell
          key={columnHeader}
          sx={{
            backgroundColor: "background.paper",
            color: "primary.contrastText",

            // Fixed 1st column
            position: i === 0 ? 'sticky' : undefined,
            left: i === 0 ? 0 : undefined
          }}
        >
          {data.get(columnHeader)}
        </TableCell>
      ));
    }
    console.error("No data found for index", index);
  };

  const headerContent = () => {
    const headerRow = Array.from(filteredData[0].keys());
    return (
      <TableRow>
        {headerRow.map((columnHeader, i) => (
          <TableCell
            key={columnHeader}
            variant="head"
            sx={{
              backgroundColor: "background.paper",
              color: "primary.light",
              fontWeight: "bold",

              // Fixed 1st column
              position: i === 0 && 'sticky',
              left: i === 0 && 0
            }}
          >
            {columnHeader}
          </TableCell>
        ))}
      </TableRow>
    );
  };

  return (
    <Paper style={{ height: "100%", width: "100%", padding: "30px" }}>
      <TableVirtuoso
        data={filteredData}
        fixedHeaderContent={headerContent}
        itemContent={itemContent}
        color="primary.contrastText"
      />
    </Paper>
  );
}
