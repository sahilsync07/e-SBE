
import { Product, RawGroup, CartItem } from './types';

// --- Hashing & Data Processing ---

export const generateProductId = (groupName: string, productName: string): string => {
  // Simple hash function for client-side usage
  const str = `${groupName.trim()}_${productName.trim()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export const normalizeData = (rawGroups: RawGroup[]): Product[] => {
  const allProducts: Product[] = [];
  rawGroups.forEach(group => {
    group.products.forEach(p => {
      allProducts.push({
        ...p,
        id: generateProductId(group.groupName, p.productName),
        groupName: group.groupName,
        searchString: `${group.groupName.toLowerCase()} ${p.productName.toLowerCase()}`
      });
    });
  });
  return allProducts;
};

// --- Storage Wrappers ---

const KEY_PRODUCTS = 'stocksync_products';
const KEY_CART = 'stocksync_cart';
const KEY_LAST_SYNC = 'stocksync_last_sync';

export const saveProductsToStorage = (products: Product[]) => {
  localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
};

export const loadProductsFromStorage = (): Product[] => {
  const data = localStorage.getItem(KEY_PRODUCTS);
  return data ? JSON.parse(data) : [];
};

export const saveCartToStorage = (cart: CartItem[]) => {
  localStorage.setItem(KEY_CART, JSON.stringify(cart));
};

export const loadCartFromStorage = (): CartItem[] => {
  const data = localStorage.getItem(KEY_CART);
  return data ? JSON.parse(data) : [];
};

export const saveLastSync = (date: string) => {
  localStorage.setItem(KEY_LAST_SYNC, date);
};

export const loadLastSync = (): string | null => {
  return localStorage.getItem(KEY_LAST_SYNC);
};

export const clearAllData = () => {
  localStorage.removeItem(KEY_PRODUCTS);
  localStorage.removeItem(KEY_CART);
  localStorage.removeItem(KEY_LAST_SYNC);
};

// --- PDF & Sharing ---

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

export const generateAndSharePDF = async (
  cart: CartItem[], 
  total: number, 
  customerName: string, 
  customerPlace: string
) => {
  try {
    // Dynamic imports to prevent app crash on initial load
    const { default: jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
    const { default: autoTable } = await import('https://esm.sh/jspdf-autotable@3.5.31');

    const doc = new jsPDF();
    const dateStr = new Date().toLocaleString();

    // Header
    doc.setFontSize(22);
    doc.text("Order Invoice", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Date: ${dateStr}`, 14, 30);
    doc.text(`Customer: ${customerName}`, 14, 36);
    doc.text(`Place: ${customerPlace}`, 14, 42);
    
    // Table
    const tableData = cart.map(item => {
      const qtyDisplay = item.sets > 0 ? `${item.sets} Set` : 'Note';
      const noteDisplay = item.note || '-';
      // We show total price for the item row
      const lineTotal = item.sets > 0 ? item.sets * item.rate : 0; 
      
      return [
        item.productName,
        qtyDisplay,
        noteDisplay,
        formatCurrency(item.rate),
        formatCurrency(lineTotal)
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [['Product', 'Qty', 'Note', 'Rate', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 10 },
    });

    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY || 100;

    doc.setFontSize(14);
    doc.text(`Grand Total: ${formatCurrency(total)}`, 14, finalY + 15);

    // Save PDF
    const filename = `Order_${customerName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);

    // Generate WhatsApp Text (Markdown)
    let waText = `*New Order*\n`;
    waText += `*Customer:* ${customerName}\n`;
    waText += `*Place:* ${customerPlace}\n`;
    waText += `*Date:* ${dateStr}\n`;
    waText += `------------------------\n`;

    cart.forEach(item => {
      waText += `*Item:* ${item.productName}\n`;
      if (item.sets > 0) {
        waText += `*Quantity:* ${item.sets} Set\n`;
      }
      if (item.note) {
        waText += `*Note:* ${item.note}\n`;
      }
      waText += `------------------------\n`;
    });

    waText += `*Total Amount:* ${formatCurrency(total)}`;
      
    const encodedMsg = encodeURIComponent(waText);
    
    // Open WhatsApp
    window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
  } catch (error) {
    console.error("Error generating PDF", error);
    alert("Failed to generate PDF. Check internet connection.");
  }
};
