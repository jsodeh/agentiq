import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import type { Invoice } from './service';
import { getPlan, formatPrice } from './plans';

export interface InvoiceData {
  invoice: Invoice;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  business: {
    name: string;
    address: string;
    phone: string;
    email: string;
    taxId?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  vat: number; // 7.5% VAT
  total: number;
}

export class InvoiceGenerator {
  private invoicesDir: string = '';

  async initialize() {
    const dataDir = await appDataDir();
    this.invoicesDir = path.join(dataDir, 'invoices');

    // Create invoices directory
    if (!fs.existsSync(this.invoicesDir)) {
      fs.mkdirSync(this.invoicesDir, { recursive: true });
    }
  }

  async generateInvoice(invoiceData: InvoiceData): Promise<string> {
    if (!this.invoicesDir) {
      await this.initialize();
    }

    const filename = `invoice_${invoiceData.invoice.id}.pdf`;
    const filepath = path.join(this.invoicesDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header
        this.generateHeader(doc, invoiceData);

        // Invoice details
        this.generateInvoiceDetails(doc, invoiceData);

        // Customer details
        this.generateCustomerDetails(doc, invoiceData);

        // Line items
        this.generateLineItems(doc, invoiceData);

        // Totals
        this.generateTotals(doc, invoiceData);

        // Footer
        this.generateFooter(doc, invoiceData);

        doc.end();

        stream.on('finish', () => {
          resolve(filepath);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private generateHeader(doc: PDFKit.PDFDocument, data: InvoiceData) {
    doc
      .fontSize(20)
      .fillColor('#6C3BFF')
      .text('agēntīq', 50, 50)
      .fontSize(10)
      .fillColor('#000000')
      .text(data.business.name, 50, 75)
      .text(data.business.address, 50, 90)
      .text(data.business.phone, 50, 105)
      .text(data.business.email, 50, 120);

    if (data.business.taxId) {
      doc.text(`Tax ID: ${data.business.taxId}`, 50, 135);
    }

    // Invoice title
    doc
      .fontSize(24)
      .fillColor('#6C3BFF')
      .text('INVOICE', 400, 50, { align: 'right' });
  }

  private generateInvoiceDetails(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const y = 180;

    doc
      .fontSize(10)
      .fillColor('#000000')
      .text(`Invoice Number: ${data.invoice.id}`, 400, y, { align: 'right' })
      .text(
        `Date: ${new Date(data.invoice.createdAt).toLocaleDateString('en-NG')}`,
        400,
        y + 15,
        { align: 'right' }
      )
      .text(`Status: ${data.invoice.status.toUpperCase()}`, 400, y + 30, {
        align: 'right',
      });

    if (data.invoice.paidAt) {
      doc.text(
        `Paid: ${new Date(data.invoice.paidAt).toLocaleDateString('en-NG')}`,
        400,
        y + 45,
        { align: 'right' }
      );
    }
  }

  private generateCustomerDetails(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const y = 180;

    doc
      .fontSize(12)
      .fillColor('#6C3BFF')
      .text('BILL TO:', 50, y)
      .fontSize(10)
      .fillColor('#000000')
      .text(data.customer.name, 50, y + 20)
      .text(data.customer.email, 50, y + 35);

    if (data.customer.phone) {
      doc.text(data.customer.phone, 50, y + 50);
    }

    if (data.customer.address) {
      doc.text(data.customer.address, 50, y + 65, { width: 200 });
    }
  }

  private generateLineItems(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const tableTop = 300;
    const itemCodeX = 50;
    const descriptionX = 150;
    const quantityX = 350;
    const priceX = 420;
    const amountX = 490;

    // Table header
    doc
      .fontSize(10)
      .fillColor('#6C3BFF')
      .text('DESCRIPTION', descriptionX, tableTop)
      .text('QTY', quantityX, tableTop)
      .text('PRICE', priceX, tableTop)
      .text('AMOUNT', amountX, tableTop);

    // Draw line
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(1)
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Line items
    let y = tableTop + 30;
    doc.fillColor('#000000');

    data.items.forEach((item) => {
      doc
        .fontSize(10)
        .text(item.description, descriptionX, y, { width: 180 })
        .text(item.quantity.toString(), quantityX, y)
        .text(formatPrice(item.unitPrice), priceX, y)
        .text(formatPrice(item.total), amountX, y);

      y += 25;
    });

    return y;
  }

  private generateTotals(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const y = 450;

    doc
      .fontSize(10)
      .text('Subtotal:', 400, y)
      .text(formatPrice(data.subtotal), 490, y)
      .text('VAT (7.5%):', 400, y + 20)
      .text(formatPrice(data.vat), 490, y + 20);

    // Draw line
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(1)
      .moveTo(400, y + 35)
      .lineTo(550, y + 35)
      .stroke();

    // Total
    doc
      .fontSize(12)
      .fillColor('#6C3BFF')
      .text('TOTAL:', 400, y + 45)
      .text(formatPrice(data.total), 490, y + 45);
  }

  private generateFooter(doc: PDFKit.PDFDocument, data: InvoiceData) {
    const y = 700;

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('Payment Information:', 50, y)
      .text('Bank: Access Bank', 50, y + 15)
      .text('Account Name: agēntīq Technologies', 50, y + 30)
      .text('Account Number: 1234567890', 50, y + 45)
      .text('', 50, y + 70)
      .text('Thank you for your business!', 50, y + 85, { align: 'center' })
      .text('For support, contact: support@agentiq.app', 50, y + 100, {
        align: 'center',
      });
  }

  async getInvoicePath(invoiceId: string): Promise<string> {
    if (!this.invoicesDir) {
      await this.initialize();
    }

    return path.join(this.invoicesDir, `invoice_${invoiceId}.pdf`);
  }

  async invoiceExists(invoiceId: string): Promise<boolean> {
    const filepath = await this.getInvoicePath(invoiceId);
    return fs.existsSync(filepath);
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    const filepath = await this.getInvoicePath(invoiceId);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}

export const invoiceGenerator = new InvoiceGenerator();
