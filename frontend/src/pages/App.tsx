import {
  Card,
  Metric,
  Text,
  Title,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@tremor/react";

const riskRows = [
  { sku: "SKU-1001", region: "West", risk: "18%", action: "Move 1,200 units from DC-North to DC-West" },
  { sku: "SKU-2088", region: "South", risk: "16%", action: "Expedite plant-to-DC lane by 2 days" },
  { sku: "SKU-3210", region: "Metro", risk: "15%", action: "Trigger promo dampening + replenish retail cluster 4" },
];

export default function App() {
  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <Title>Executive Supply Chain Control Tower</Title>
      <Text>Physical-Digital Twin KPI View (OSA, Inventory Health, and Priority Redistribution)</Text>
      <Grid numItems={1} numItemsMd={3} className="gap-6">
        <Card>
          <Text>On-Shelf Availability (OSA)</Text>
          <Metric>96.2%</Metric>
        </Card>
        <Card>
          <Text>Inventory Health Index</Text>
          <Metric>1.14</Metric>
        </Card>
        <Card>
          <Text>SKUs Above 15% Stockout Risk</Text>
          <Metric>3</Metric>
        </Card>
      </Grid>
      <Card>
        <Title>Inventory Health Map (placeholder)</Title>
        <Text>Integrate geo data layer to render stock-to-sales heat map by region.</Text>
        <div className="mt-4 h-56 w-full rounded-md border border-slate-200 bg-slate-100" />
      </Card>
      <Card>
        <Title>AI Priority Redistribution List</Title>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>SKU</TableHeaderCell>
              <TableHeaderCell>Region</TableHeaderCell>
              <TableHeaderCell>Stockout Risk</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {riskRows.map((row) => (
              <TableRow key={`${row.sku}-${row.region}`}>
                <TableCell>{row.sku}</TableCell>
                <TableCell>{row.region}</TableCell>
                <TableCell>{row.risk}</TableCell>
                <TableCell>{row.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}
