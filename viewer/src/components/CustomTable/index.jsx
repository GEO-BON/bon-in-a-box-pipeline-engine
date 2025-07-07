import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { TableVirtuoso } from "react-virtuoso";

export default function CustomTable({ tableData }) {

  console.log("tableData", tableData)
  // Remove empty rows
  const filteredData = tableData.filter(
    (f) =>
      !Object.values(f).every((e) => {
        e === "";
      })
  );

  const itemContent = (index, data) => {
    if (data) {
      console.log(index, data)
      const head = Object.keys(filteredData[0]);
      return head.map((h, i) => (
        <TableCell
          key={h}
          sx={{
            backgroundColor: "background.paper",
            color: "primary.contrastText",

            // Fixed 1st column
            position: i === 0 ? 'sticky' : undefined,
            left: i === 0 ? 0 : undefined
          }}
        >
          {data[h]}
        </TableCell>
      ));
    }
    return;
  };

  const headerContent = () => {
    const head = Object.keys(filteredData[0]);
    return (
      <TableRow>
        {head.map((column, i) => (
          <TableCell
            key={column}
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
            {column}
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
