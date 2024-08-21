import React, { useState, useEffect } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { TableVirtuoso } from "react-virtuoso";
import { colors } from "../../styles";

export default function CustomTable(props) {
  const { tableData } = props;

  const tableD = tableData.filter(
    (f) =>
      !Object.values(f).every((e) => {
        e === "";
      })
  );

  const head = Object.keys(tableData[0]);

  const itemContent = (index, data) => {
    const head = Object.keys(tableD[0]);
    if (data) {
      return head.map((h) => (
        <TableCell
          key={h}
          sx={{
            backgroundColor: "background.paper",
            color: "primary.contrastText",
          }}
        >
          {data[h]}
        </TableCell>
      ));
    }
    return;
  };

  const headerContent = () => {
    const head = Object.keys(tableD[0]);
    return (
      <TableRow>
        {head.map((column) => (
          <TableCell
            key={column}
            variant="head"
            sx={{
              backgroundColor: "background.paper",
              color: "primary.light",
              fontWeight: "bold",
            }}
          >
            {column}
          </TableCell>
        ))}
      </TableRow>
    );
  };

  useEffect(() => {
    const head = Object.keys(tableD[0]);
  }, [tableD]);

  return (
    <Paper style={{ height: "100%", width: "100%", padding: "30px" }}>
      <TableVirtuoso
        data={tableD}
        fixedHeaderContent={headerContent}
        itemContent={itemContent}
        color="primary.contrastText"
      />
    </Paper>
  );
}
