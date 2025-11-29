
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { 
  Search, RefreshCw, ShoppingCart, Settings, ArrowLeft, 
  Trash2, Share2, X, Maximize2, MapPin, User,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Product, CartItem } from './types';
import { 
  loadProductsFromStorage, loadCartFromStorage, loadLastSync, 
  saveCartToStorage, generateAndSharePDF, clearAllData 
} from './utils';
import { performSync } from './services/syncService';

// --- Context ---
interface AppContextType {
  products: Product[];
  cart: CartItem[];
  lastSync: string | null;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  syncData: () => Promise<void>;
  clearData: () => void;
  isSyncing: boolean;
}

const AppContext = React.createContext<AppContextType>({} as AppContextType);

// --- Components ---

const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

// --- Checkout Modal ---
const CheckoutModal = ({ 
  isOpen, 
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (name: string, place: string) => void; 
}) => {
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (name && place) {
      setIsGenerating(true);
      await onConfirm(name, place);
      setIsGenerating(false);
    } else {
      alert("Please fill in all fields");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Confirm Order Details</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
          <div className="relative">
            <User size={18} className="absolute left-3 top-3 text-gray-400" />
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter name"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Location / Place</label>
          <div className="relative">
            <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
            <input 
              type="text" 
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter location"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isGenerating}
            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex justify-center items-center"
          >
            {isGenerating ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Share PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 1. Home Page (Grid Layout)
const HomePage = () => {
  const { products, lastSync, syncData, isSyncing, cart } = React.useContext(AppContext);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const groupedProducts = useMemo(() => {
    const filtered = products.filter(p => p.searchString.includes(search.toLowerCase()));
    const groups: Record<string, Product[]> = {};
    filtered.forEach(p => {
      if (!groups[p.groupName]) groups[p.groupName] = [];
      groups[p.groupName].push(p);
    });
    return groups;
  }, [products, search]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-bold tracking-tight">StockSync</h1>
          <div className="flex gap-3">
            <button onClick={syncData} disabled={isSyncing} className="p-2 bg-blue-700 rounded-full hover:bg-blue-800">
              {isSyncing ? <LoadingSpinner /> : <RefreshCw size={18} />}
            </button>
            <Link to="/settings" className="p-2 bg-blue-700 rounded-full hover:bg-blue-800">
              <Settings size={18} />
            </Link>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search products..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-blue-100 mt-2 text-right">
            Last Synced: {lastSync || 'Never'}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-2 pb-24">
        {Object.keys(groupedProducts).length === 0 && !isSyncing && (
           <div className="text-center mt-10 text-gray-500">
             <p className="mb-4">No products found.</p>
             <button onClick={syncData} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Sync Now</button>
           </div>
        )}

        {Object.entries(groupedProducts).map(([groupName, items]) => (
          <div key={groupName} className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2 px-1">{groupName}</h2>
            <div className="grid grid-cols-2 gap-3">
              {(items as Product[]).map(product => (
                 <div 
                    key={product.id} 
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col active:scale-95 transition-transform duration-100"
                 >
                   <div className="aspect-square w-full bg-gray-200 relative">
                     <img 
                       src={product.imageUrl} 
                       alt={product.productName} 
                       className="w-full h-full object-cover"
                       onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/300?text=No+Image')}
                       loading="lazy"
                     />
                   </div>
                   <div className="p-3 flex flex-col flex-1">
                     <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight mb-1">{product.productName}</h3>
                     <div className="mt-auto">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Stock: {product.quantity}</span>
                     </div>
                   </div>
                 </div>
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* FAB Cart */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <Link to="/cart" className="flex items-center justify-center w-14 h-14 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition">
            <ShoppingCart size={24} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {cart.length}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
};

// 2. Product Detail Page (Swipe + Exclusive Select + Fullscreen)
const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { products, addToCart, cart } = React.useContext(AppContext);
  
  const currentIndex = products.findIndex(p => p.id === id);
  const product = products[currentIndex];

  // Selection State: '1'|'2'|'3'|'note'
  const [selectedOption, setSelectedOption] = useState<'1'|'2'|'3'|'note'>('1');
  const [noteText, setNoteText] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Current Item in Cart
  const cartItem = cart.find(c => c.productId === product?.id);

  // Swipe Logic
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Only navigate if it's a clear swipe, not a scroll
    if (Math.abs(distance) > minSwipeDistance) {
      if (isLeftSwipe && currentIndex < products.length - 1) {
        navigate(`/product/${products[currentIndex + 1].id}`, { replace: true });
      }
      if (isRightSwipe && currentIndex > 0) {
        navigate(`/product/${products[currentIndex - 1].id}`, { replace: true });
      }
    }
  };

  // Reset state on navigation
  useEffect(() => {
    setSelectedOption('1');
    setNoteText('');
    setIsFullScreen(false);
  }, [id]);

  if (!product) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Link to="/" className="text-blue-500 font-medium">Return Home</Link>
      </div>
    );
  }

  const handleCommit = () => {
    let sets = 0;
    let note = '';

    if (selectedOption === 'note') {
      if (!noteText.trim()) {
        alert("Please enter a note");
        return;
      }
      sets = 0; // Note mode implies specific instruction, not standard set count
      note = noteText;
    } else {
      sets = parseInt(selectedOption);
      note = ''; // Clear note if set selected
    }

    addToCart({
      productId: product.id,
      productName: product.productName,
      rate: product.rate,
      sets: sets,
      note: note,
      imageUrl: product.imageUrl,
      groupName: product.groupName
    });
  };

  const goBack = () => {
    // Check if we are in a fresh session (direct land/refresh) or have history
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  const navigateToPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      navigate(`/product/${products[currentIndex - 1].id}`, { replace: true });
    }
  };

  const navigateToNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < products.length - 1) {
      navigate(`/product/${products[currentIndex + 1].id}`, { replace: true });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white relative">
      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <button 
          onClick={navigateToPrev}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/70 backdrop-blur-sm shadow-md rounded-r-lg text-gray-800 hover:bg-white transition-all active:bg-gray-200"
          aria-label="Previous Product"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {currentIndex < products.length - 1 && (
        <button 
          onClick={navigateToNext}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/70 backdrop-blur-sm shadow-md rounded-l-lg text-gray-800 hover:bg-white transition-all active:bg-gray-200"
          aria-label="Next Product"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Fullscreen Viewer */}
      {isFullScreen && (
        <div 
           className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center"
           onTouchStart={onTouchStart}
           onTouchMove={onTouchMove}
           onTouchEnd={onTouchEnd}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(false); }}
            className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full z-50 cursor-pointer"
          >
            <X size={32} />
          </button>
          
          {/* Fullscreen Arrows */}
          {currentIndex > 0 && (
            <button 
              onClick={navigateToPrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-50 p-3 bg-black/30 text-white rounded-r-lg"
            >
              <ChevronLeft size={40} />
            </button>
          )}
          {currentIndex < products.length - 1 && (
             <button 
              onClick={navigateToNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-50 p-3 bg-black/30 text-white rounded-l-lg"
            >
              <ChevronRight size={40} />
            </button>
          )}

          <img 
            src={product.imageUrl} 
            className="max-w-full max-h-full object-contain"
            alt="Fullscreen"
            onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/800?text=No+Image')}
          />
          <div className="absolute bottom-10 text-white text-sm">
            Swipe left/right to browse
          </div>
        </div>
      )}

      {/* App Bar */}
      <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10 border-b">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            goBack(); 
          }} 
          className="p-2 mr-2 -ml-2 rounded-full hover:bg-gray-100 z-20 cursor-pointer active:bg-gray-200"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <div className="flex-1 overflow-hidden">
          <h2 className="text-lg font-bold text-gray-800 truncate">{product.productName}</h2>
          <p className="text-xs text-gray-500">{product.groupName}</p>
        </div>
      </div>

      {/* Main Content - Swipe Handlers applied HERE */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Main Image */}
        <div className="relative mb-6">
          <img 
            onClick={() => setIsFullScreen(true)}
            src={product.imageUrl} 
            alt={product.productName} 
            className="w-full h-72 object-contain bg-gray-50 rounded-lg"
            onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400?text=No+Image')}
          />
          <button 
            onClick={() => setIsFullScreen(true)}
            className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-lg"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Info */}
        <div className="flex justify-between items-center mb-6 bg-gray-50 p-4 rounded-lg">
           <div>
             <span className="text-sm text-gray-500">Available Stock</span>
             <p className="text-2xl font-bold text-gray-800">{product.quantity}</p>
           </div>
           {/* Rate is hidden per requirements */}
        </div>

        {/* Exclusive Selection Controls */}
        <div className="mb-6">
           <label className="text-sm font-semibold text-gray-700 mb-3 block">Select Quantity / Mode</label>
           <div className="grid grid-cols-4 gap-2 mb-4">
              {['1', '2', '3'].map(opt => (
                <button
                  key={opt}
                  onClick={() => { setSelectedOption(opt as any); setNoteText(''); }}
                  className={`py-3 rounded-lg font-bold border ${
                    selectedOption === opt 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt} Set
                </button>
              ))}
              <button
                 onClick={() => setSelectedOption('note')}
                 className={`py-3 rounded-lg font-bold border ${
                   selectedOption === 'note'
                   ? 'bg-blue-600 text-white border-blue-600' 
                   : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                 }`}
               >
                 Note
               </button>
           </div>

           {selectedOption === 'note' && (
             <div className="animate-fade-in">
               <textarea
                 value={noteText}
                 onChange={(e) => setNoteText(e.target.value)}
                 placeholder="Enter quantity description (e.g. 6x9 Black 1set)"
                 className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px]"
               />
             </div>
           )}
        </div>
        
        {/* Live Feedback */}
        {cartItem && (
          <div className="mb-6 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center text-green-800 text-sm">
            <ShoppingCart size={16} className="mr-2" />
            <span className="font-medium">
              Added to Cart: {cartItem.sets > 0 ? `${cartItem.sets} Set(s)` : `Note: ${cartItem.note}`}
            </span>
          </div>
        )}

        <div className="h-20"></div> 
      </div>

      {/* Bottom Bar */}
      <div className="p-4 bg-white border-t border-gray-200 sticky bottom-0 flex gap-3 z-10">
        <button 
          onClick={handleCommit}
          className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-lg active:scale-95 transform"
        >
          {cartItem ? 'Update Cart' : 'Add to Cart'}
        </button>
        {cart.length > 0 && (
          <button 
            onClick={() => navigate('/cart')}
            className="flex-none px-5 bg-gray-100 text-gray-800 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition border border-gray-200"
          >
             <ShoppingCart size={22} />
          </button>
        )}
      </div>
    </div>
  );
};

// 3. Cart Page (With Images & Checkout)
const CartPage = () => {
  const { cart, removeFromCart } = React.useContext(AppContext);
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculate total (only for sets, assuming note items are 0 price or handled manually)
  const total = cart.reduce((acc, item) => acc + (item.sets * item.rate), 0);

  const handleConfirmShare = async (name: string, place: string) => {
    await generateAndSharePDF(cart, total, name, place);
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
       <CheckoutModal 
         isOpen={isModalOpen} 
         onClose={() => setIsModalOpen(false)} 
         onConfirm={handleConfirmShare} 
       />

       <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 mr-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-bold flex-1">Cart ({cart.length})</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {cart.length === 0 ? (
          <div className="text-center mt-20 text-gray-500">
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-50"/>
            <p>Your cart is empty.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.productId} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-3 items-start">
                <img 
                   src={item.imageUrl} 
                   className="w-20 h-20 object-cover rounded-lg bg-gray-100 flex-shrink-0"
                   onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150')}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                     <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 leading-snug">{item.productName}</h3>
                     <button onClick={() => removeFromCart(item.productId)} className="text-red-500 p-1 -mt-1 -mr-1">
                       <Trash2 size={18} />
                     </button>
                  </div>
                  
                  <div className="mt-2">
                    {item.sets > 0 ? (
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                        {item.sets} Set{item.sets > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <div className="text-sm text-gray-700 italic bg-gray-50 p-2 rounded border border-gray-100 mt-1">
                        Note: {item.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg"
          >
            <Share2 size={20} />
            Place Order & Share
          </button>
        </div>
      )}
    </div>
  );
};

// 4. Settings
const SettingsPage = () => {
  const { clearData, lastSync } = React.useContext(AppContext);
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gray-50">
      <div className="bg-white p-4 shadow-sm flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 mr-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-2">Sync Status</h2>
          <p className="text-sm text-gray-600">Last Synced: {lastSync || 'Never'}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Data Management</h2>
          <button 
            onClick={() => {
              if (window.confirm("Clear all data?")) {
                clearData();
                navigate('/');
              }
            }}
            className="w-full py-3 border border-red-500 text-red-600 rounded-lg hover:bg-red-50"
          >
            Clear Cache & Data
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const AppContent = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
};

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    try {
      const loadedProducts = loadProductsFromStorage();
      const loadedCart = loadCartFromStorage();
      const loadedSync = loadLastSync();
      
      if (loadedProducts) setProducts(loadedProducts);
      if (loadedCart) setCart(loadedCart);
      if (loadedSync) setLastSync(loadedSync);
    } catch (e) {
      console.error("Failed to load initial data", e);
    }
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { products: newProducts, stats } = await performSync();
      setProducts(newProducts);
      setLastSync(stats.lastSynced);
      alert(`Sync Complete! Added: ${stats.added}, Updated: ${stats.updated}`);
    } catch (e) {
      alert("Sync Failed. Please check your internet connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      // Logic: If item exists, REPLACE it fully because logic is exclusive (Radio behavior)
      const existingIdx = prev.findIndex(i => i.productId === item.productId);
      let newCart;
      if (existingIdx >= 0) {
        newCart = [...prev];
        newCart[existingIdx] = item;
      } else {
        newCart = [...prev, item];
      }
      saveCartToStorage(newCart);
      return newCart;
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const newCart = prev.filter(i => i.productId !== id);
      saveCartToStorage(newCart);
      return newCart;
    });
  };

  const clearData = () => {
    clearAllData();
    setProducts([]);
    setCart([]);
    setLastSync(null);
  };

  return (
    <AppContext.Provider value={{ 
      products, cart, lastSync, addToCart, removeFromCart, 
      syncData: handleSync, clearData, isSyncing 
    }}>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppContext.Provider>
  );
}
