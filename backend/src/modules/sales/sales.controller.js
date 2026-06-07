import { apiResponse } from '../../utils/apiResponse.js';
import * as salesService from './sales.service.js';
import { salesQuerySchema } from './sales.schema.js';

export async function getSales(req, res) {
  // Parse + validate query params (not body — use querySchema)
  const query = salesQuerySchema.parse({
    ...req.query,
    page:  req.query.page  ? Number(req.query.page)  : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });

  const result = await salesService.listSales(req.user.id, query);

  return apiResponse.success(res, {
    message: 'Sales fetched',
    data: result.sales,
    meta: result.pagination,
  });
}

export async function getSale(req, res) {
  const sale = await salesService.getSaleById(req.user.id, req.params.id);
  return apiResponse.success(res, { data: sale });
}

export async function createSale(req, res) {
  const sale = await salesService.createManualSale(req.user.id, req.body);
  return apiResponse.success(res, {
    message: 'Sale recorded',
    data: sale,
    statusCode: 201,
  });
}

export async function deleteSale(req, res) {
  await salesService.deleteSale(req.user.id, req.params.id);
  return apiResponse.success(res, { message: 'Sale deleted' });
}

export async function exportSales(req, res) {
  const query = salesQuerySchema.parse({
    ...req.query,
    page: 1,
    limit: 5000,
  });

  const csv = await salesService.exportSalesCSV(req.user.id, query);

  if (!csv) {
    return apiResponse.success(res, {
      message: 'No sales found for the selected period',
      data: null,
    });
  }

  // Return as downloadable CSV file
  const filename = `traqq-sales-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
}
