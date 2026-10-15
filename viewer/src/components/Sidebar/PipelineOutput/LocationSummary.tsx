import { Box, Typography } from "@mui/material";

const Row = ({ label, value }: { label: string; value: any }) =>
  value ? (
    <Typography color="secondary.light" fontSize={12}>
      <b>{label}:</b> {value}
    </Typography>
  ) : null;

export function LocationSummary({ location }: { location: any }) {
  const { country, region, CRS, bbox } = location || {};
  const crs =
    CRS && `${CRS.name ?? ""} (${CRS.authority ?? "EPSG"}:${CRS.code})`.trim();

  return (
    <Box sx={{ mb: 1 }}>
      <Row
        label="Country"
        value={
          country?.englishName &&
          `${country.englishName}${country.ISO3 ? ` (${country.ISO3})` : ""}`
        }
      />
      <Row label="Region" value={region?.regionName} />
      <Row label="CRS" value={crs} />
      {Array.isArray(bbox) && bbox.length === 4 && (
        <>
          <Typography color="secondary.light" fontSize={12}>
            <b>Bounding box:</b>
          </Typography>
          <Typography
            color="secondary.light"
            fontSize={11}
            sx={{ fontFamily: "monospace", pl: 1 }}
          >
            Min X: {bbox[0]}
            <br />
            Min Y: {bbox[1]}
            <br />
            Max X: {bbox[2]}
            <br />
            Max Y: {bbox[3]}
          </Typography>
        </>
      )}
    </Box>
  );
}
