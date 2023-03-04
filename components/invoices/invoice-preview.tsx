import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { formatEuro, formatDate, numberToWords } from "@/lib/utils";
import type { Invoice, InvoiceLineItem } from "@/lib/types";

interface InvoicePreviewProps {
  invoice: Invoice & { clientName: string };
  lineItems: InvoiceLineItem[];
}

export function InvoicePreview({ invoice, lineItems }: InvoicePreviewProps) {
  const hasSepa = invoice.fromSepaIban || invoice.fromSepaAccountName;
  const hasSwift = invoice.fromSwiftIban || invoice.fromSwiftAccountName;
  const hasBankDetails = hasSepa || hasSwift || invoice.fromBankName || invoice.fromBankAccount;

  return (
    <div className="mx-auto max-w-3xl space-y-8 rounded-lg border border-border bg-white p-8 text-black shadow-sm print:border-none print:shadow-none print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">INVOICE</h1>
          <p className="mt-1 text-lg font-semibold text-gray-700">
            {invoice.invoiceNumber}
          </p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>
            <span className="font-medium">Issue Date:</span>{" "}
            {formatDate(invoice.issueDate)}
          </p>
          {invoice.dueDate && (
            <p>
              <span className="font-medium">Due Date:</span>{" "}
              {formatDate(invoice.dueDate)}
            </p>
          )}
          <p>
            <span className="font-medium">Period:</span>{" "}
            {formatDate(invoice.billingPeriodStart)} &ndash;{" "}
            {formatDate(invoice.billingPeriodEnd)}
          </p>
        </div>
      </div>

      <Separator />

      {/* From / To */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            From
          </h3>
          <div className="text-sm leading-relaxed">
            {invoice.fromName && (
              <p className="font-semibold">{invoice.fromName}</p>
            )}
            {invoice.fromCompany && <p>{invoice.fromCompany}</p>}
            {invoice.fromAddress && (
              <p className="text-gray-600">{invoice.fromAddress}</p>
            )}
            {invoice.fromEmail && (
              <p className="text-gray-600">{invoice.fromEmail}</p>
            )}
            {invoice.fromPhone && (
              <p className="text-gray-600">{invoice.fromPhone}</p>
            )}
            {invoice.fromGstin && (
              <p className="mt-1 font-medium text-gray-700">
                GSTIN: {invoice.fromGstin}
              </p>
            )}
            {invoice.fromPan && (
              <p className="font-medium text-gray-700">
                PAN: {invoice.fromPan}
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            To
          </h3>
          <div className="text-sm leading-relaxed">
            {invoice.toName && (
              <p className="font-semibold">{invoice.toName}</p>
            )}
            {invoice.toCompany && <p>{invoice.toCompany}</p>}
            {invoice.toAddress && (
              <p className="text-gray-600">{invoice.toAddress}</p>
            )}
            {invoice.toEmail && (
              <p className="text-gray-600">{invoice.toEmail}</p>
            )}
            {invoice.toGstin && (
              <p className="mt-1 text-gray-600">
                <span className="font-medium">GSTIN:</span> {invoice.toGstin}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Line Items */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">HSN/SAC</TableHead>
            <TableHead className="w-[70px] text-right">Qty</TableHead>
            <TableHead className="w-[100px] text-right">Rate</TableHead>
            <TableHead className="w-[110px] text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.map((item, index) => (
            <TableRow key={item.id}>
              <TableCell className="text-gray-500">{index + 1}</TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell className="text-gray-600">
                {item.hsnSac || "-"}
              </TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">
                {formatEuro(item.unitPrice)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatEuro(item.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatEuro(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">IGST (0%)</span>
            <span>{formatEuro(0)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatEuro(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="rounded bg-gray-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Amount in Words
        </p>
        <p className="mt-1 text-sm font-medium text-gray-800">
          {numberToWords(invoice.total)}
        </p>
      </div>

      {/* LUT Note */}
      <p className="text-xs italic text-gray-500">
        Supply meant for export of services under LUT without payment of IGST
      </p>

      {/* SEPA / SWIFT Bank Details */}
      {hasBankDetails && (
        <>
          <Separator />
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Bank Details for Payment
            </h3>
            {(hasSepa || hasSwift) ? (
              <div className="grid grid-cols-2 gap-8">
                {/* SEPA Transfer Column */}
                {hasSepa && (
                  <div>
                    <h4 className="mb-3 text-sm font-bold text-gray-800">
                      SEPA Transfer
                    </h4>
                    <div className="space-y-1.5 text-sm text-gray-600">
                      {invoice.fromSepaAccountName && (
                        <div>
                          <span className="font-medium text-gray-700">Account Name</span>
                          <p>{invoice.fromSepaAccountName}</p>
                        </div>
                      )}
                      {invoice.fromSepaIban && (
                        <div>
                          <span className="font-medium text-gray-700">IBAN</span>
                          <p className="font-mono text-xs">{invoice.fromSepaIban}</p>
                        </div>
                      )}
                      {invoice.fromSepaBic && (
                        <div>
                          <span className="font-medium text-gray-700">SWIFT/BIC Code</span>
                          <p className="font-mono text-xs">{invoice.fromSepaBic}</p>
                        </div>
                      )}
                      {invoice.fromSepaBank && (
                        <div>
                          <span className="font-medium text-gray-700">Bank</span>
                          <p>{invoice.fromSepaBank}</p>
                        </div>
                      )}
                      {invoice.fromSepaAccountType && (
                        <div>
                          <span className="font-medium text-gray-700">Account Type</span>
                          <p>{invoice.fromSepaAccountType}</p>
                        </div>
                      )}
                      {invoice.fromSepaAddress && (
                        <div>
                          <span className="font-medium text-gray-700">Address</span>
                          <p>{invoice.fromSepaAddress}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SWIFT Transfer Column */}
                {hasSwift && (
                  <div>
                    <h4 className="mb-3 text-sm font-bold text-gray-800">
                      SWIFT Transfer
                    </h4>
                    <div className="space-y-1.5 text-sm text-gray-600">
                      {invoice.fromSwiftAccountName && (
                        <div>
                          <span className="font-medium text-gray-700">Account Name</span>
                          <p>{invoice.fromSwiftAccountName}</p>
                        </div>
                      )}
                      {invoice.fromSwiftIban && (
                        <div>
                          <span className="font-medium text-gray-700">IBAN</span>
                          <p className="font-mono text-xs">{invoice.fromSwiftIban}</p>
                        </div>
                      )}
                      {invoice.fromSwiftBic && (
                        <div>
                          <span className="font-medium text-gray-700">SWIFT/BIC Code</span>
                          <p className="font-mono text-xs">{invoice.fromSwiftBic}</p>
                        </div>
                      )}
                      {invoice.fromSwiftBank && (
                        <div>
                          <span className="font-medium text-gray-700">Bank</span>
                          <p>{invoice.fromSwiftBank}</p>
                        </div>
                      )}
                      {invoice.fromSwiftAccountType && (
                        <div>
                          <span className="font-medium text-gray-700">Account Type</span>
                          <p>{invoice.fromSwiftAccountType}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: legacy single bank details */
              <div className="text-sm leading-relaxed text-gray-600">
                {invoice.fromBankName && (
                  <p>
                    <span className="font-medium">Bank:</span>{" "}
                    {invoice.fromBankName}
                  </p>
                )}
                {invoice.fromBankBranch && (
                  <p>
                    <span className="font-medium">Branch:</span>{" "}
                    {invoice.fromBankBranch}
                  </p>
                )}
                {invoice.fromBankAccount && (
                  <p>
                    <span className="font-medium">Account No:</span>{" "}
                    {invoice.fromBankAccount}
                  </p>
                )}
                {invoice.fromBankIfsc && (
                  <p>
                    <span className="font-medium">IFSC:</span>{" "}
                    {invoice.fromBankIfsc}
                  </p>
                )}
                {invoice.fromBankIban && (
                  <p>
                    <span className="font-medium">IBAN:</span>{" "}
                    {invoice.fromBankIban}
                  </p>
                )}
                {invoice.fromBankBic && (
                  <p>
                    <span className="font-medium">BIC/SWIFT:</span>{" "}
                    {invoice.fromBankBic}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Notes */}
      {invoice.notes && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Notes
            </h3>
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {invoice.notes}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
