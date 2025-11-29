
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { 
  Search, RefreshCw, ShoppingCart, Settings, ArrowLeft, 
  Trash2, Share2, X, Maximize2, MapPin, User,
  ChevronLeft, ChevronRight, Package
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

// Modern Image Component with Fallback Icon
const ProductImage = ({ src, alt, className, iconSize = 24 }: { src: string, alt: string, className?: string, iconSize?: number }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}>
        <Package size={iconSize} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl scale-100 transform transition-all">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Checkout</h2>
        
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2 ml-1">Customer Name</label>
            <div className="relative group">
              <User size={20} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-violet-600 transition-colors" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all font-medium"
                placeholder="Ex: John Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2 ml-1">Location / Place</label>
            <div className="relative group">
              <MapPin size={20} className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-violet-600 transition-colors" />
              <input 
                type="text" 
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all font-medium"
                placeholder="Ex: New York"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isGenerating}
            className="flex-1 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 active:scale-95 transition-all flex justify-center items-center"
          >
            {isGenerating ? <LoadingSpinner /> : 'Share PDF'}
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
    <div className="flex flex-col h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-4 pb-6 shadow-lg sticky top-0 z-20 rounded-b-[2rem]">
        <div className="flex justify-between items-center mb-4 px-1">
          <h1 className="text-2xl font-bold tracking-tight">StockSync</h1>
          <div className="flex gap-2">
            <button 
              onClick={syncData} 
              disabled={isSyncing} 
              className="p-2.5 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition active:scale-95"
            >
              {isSyncing ? <LoadingSpinner /> : <RefreshCw size={20} />}
            </button>
            <Link 
              to="/settings" 
              className="p-2.5 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition active:scale-95"
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
        
        <div className="relative mb-1">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search inventory..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl text-gray-900 bg-white/95 backdrop-blur shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder-gray-400 font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-violet-200 mt-2 text-right pr-2 font-medium opacity-80">
            Last Synced: {lastSync || 'Never'}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-3 pb-24 space-y-6">
        {Object.keys(groupedProducts).length === 0 && !isSyncing && (
           <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
             <Package size={64} strokeWidth={1} className="mb-4 text-gray-300" />
             <p className="mb-4 font-medium">No products found.</p>
             <button onClick={syncData} className="px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-xl shadow-lg active:scale-95 transition">Sync Now</button>
           </div>
        )}

        {Object.entries(groupedProducts).map(([groupName, items]) => (
          <div key={groupName}>
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="h-4 w-1 bg-violet-500 rounded-full"></div>
              <h2 className="text-lg font-bold text-gray-800 tracking-tight">{groupName}</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {(items as Product[]).map(product => (
                 <div 
                    key={product.id} 
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col active:scale-[0.98] transition-all duration-200"
                 >
                   <div className="aspect-[4/3] w-full relative bg-gray-50">
                     <ProductImage 
                       src={product.imageUrl} 
                       alt={product.productName} 
                       className="w-full h-full object-cover"
                       iconSize={32}
                     />
                   </div>
                   <div className="p-3 flex flex-col flex-1">
                     <h3 className="text-[15px] font-semibold text-gray-800 line-clamp-2 leading-snug mb-2">{product.productName}</h3>
                     <div className="mt-auto">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${product.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.quantity > 0 ? `${product.quantity} in stock` : 'Out of stock'}
                        </span>
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
        <div className="fixed bottom-6 right-6 z-30 animate-bounce-in">
          <Link 
            to="/cart" 
            className="flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-90"
          >
            <ShoppingCart size={28} />
            <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
           <Package size={48} className="mx-auto text-gray-300 mb-2"/>
           <p className="text-gray-500 mb-4">Product not found</p>
           <Link to="/" className="text-violet-600 font-bold hover:underline">Return Home</Link>
        </div>
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
    <div className="flex flex-col h-screen bg-gray-50 relative">
      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <button 
          onClick={navigateToPrev}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/80 backdrop-blur-md shadow-lg rounded-r-2xl text-gray-700 hover:text-violet-600 hover:pl-4 transition-all active:scale-95 border border-l-0 border-gray-100"
          aria-label="Previous Product"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {currentIndex < products.length - 1 && (
        <button 
          onClick={navigateToNext}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/80 backdrop-blur-md shadow-lg rounded-l-2xl text-gray-700 hover:text-violet-600 hover:pr-4 transition-all active:scale-95 border border-r-0 border-gray-100"
          aria-label="Next Product"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Fullscreen Viewer */}
      {isFullScreen && (
        <div 
           className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-center items-center animate-in fade-in duration-300"
           onTouchStart={onTouchStart}
           onTouchMove={onTouchMove}
           onTouchEnd={onTouchEnd}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(false); }}
            className="absolute top-6 right-6 text-white/80 hover:text-white p-2 bg-white/10 rounded-full z-50 cursor-pointer backdrop-blur"
          >
            <X size={28} />
          </button>
          
          <ProductImage 
            src={product.imageUrl} 
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain p-2"
            iconSize={64}
          />
          
          <div className="absolute bottom-10 text-white/50 text-sm font-medium tracking-wide">
            Swipe to browse
          </div>
        </div>
      )}

      {/* App Bar */}
      <div className="bg-white/80 backdrop-blur-md p-4 shadow-sm flex items-center sticky top-0 z-10 border-b border-gray-100">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            goBack(); 
          }} 
          className="p-2.5 mr-3 -ml-2 rounded-full hover:bg-gray-100 z-20 cursor-pointer active:scale-90 transition"
        >
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div className="flex-1 overflow-hidden">
          <h2 className="text-lg font-bold text-gray-800 truncate leading-tight">{product.productName}</h2>
          <p className="text-xs font-medium text-violet-600">{product.groupName}</p>
        </div>
      </div>

      {/* Main Content - Swipe Handlers applied HERE */}
      <div 
        className="flex-1 overflow-y-auto p-5"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Main Image */}
        <div className="relative mb-8 group">
          <div className="aspect-square bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex items-center justify-center relative overflow-hidden">
             {/* Dot Pattern Background */}
             <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]"></div>
             
             <ProductImage 
                src={product.imageUrl} 
                alt={product.productName} 
                className="w-full h-full object-contain z-10 drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
                iconSize={80}
             />
             
             {/* Maximize Button */}
             <button 
                onClick={() => setIsFullScreen(true)}
                className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-gray-700 p-2.5 rounded-xl shadow-md border border-gray-100 active:scale-90 transition z-20"
              >
                <Maximize2 size={20} />
              </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex justify-between items-center mb-8">
           <div>
             <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Available Stock</span>
             <p className="text-3xl font-black text-gray-800 tracking-tight mt-0.5">{product.quantity}</p>
           </div>
           {cartItem && (
             <div className="px-4 py-2 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm font-bold flex items-center shadow-sm animate-pulse-once">
                <ShoppingCart size={16} className="mr-2" />
                <span>In Cart</span>
             </div>
           )}
        </div>

        {/* Exclusive Selection Controls */}
        <div className="mb-8">
           <label className="text-sm font-bold text-gray-800 mb-4 block">Select Quantity</label>
           <div className="grid grid-cols-4 gap-3 mb-5">
              {['1', '2', '3'].map(opt => (
                <button
                  key={opt}
                  onClick={() => { setSelectedOption(opt as any); setNoteText(''); }}
                  className={`py-3.5 rounded-xl font-bold transition-all duration-200 shadow-sm active:scale-95 ${
                    selectedOption === opt 
                    ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-indigo-200 shadow-lg ring-2 ring-violet-200' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300 hover:bg-gray-50'
                  }`}
                >
                  {opt} Set
                </button>
              ))}
              <button
                 onClick={() => setSelectedOption('note')}
                 className={`py-3.5 rounded-xl font-bold transition-all duration-200 shadow-sm active:scale-95 ${
                   selectedOption === 'note'
                    ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-indigo-200 shadow-lg ring-2 ring-violet-200' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300 hover:bg-gray-50'
                 }`}
               >
                 Note
               </button>
           </div>

           {selectedOption === 'note' && (
             <div className="animate-in slide-in-from-top-2 duration-200">
               <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">Custom Note</label>
               <textarea
                 value={noteText}
                 onChange={(e) => setNoteText(e.target.value)}
                 placeholder="e.g. 6x9 Black 1set..."
                 className="w-full p-4 border border-gray-300 bg-white rounded-2xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none shadow-sm text-gray-800 font-medium min-h-[100px] resize-none"
               />
             </div>
           )}
        </div>
        
        {/* Live Feedback */}
        {cartItem && (
          <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 p-4 rounded-2xl flex items-center text-green-800 text-sm shadow-sm">
            <div className="bg-green-100 p-2 rounded-full mr-3">
              <ShoppingCart size={18} className="text-green-600" />
            </div>
            <div>
               <p className="text-xs text-green-600 font-semibold uppercase">Currently in cart</p>
               <p className="font-bold text-base">
                 {cartItem.sets > 0 ? `${cartItem.sets} Set(s)` : `${cartItem.note}`}
               </p>
            </div>
          </div>
        )}

        <div className="h-24"></div> 
      </div>

      {/* Bottom Bar */}
      <div className="p-4 bg-white/90 backdrop-blur-lg border-t border-gray-200 sticky bottom-0 flex gap-3 z-30 pb-6">
        <button 
          onClick={handleCommit}
          className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition shadow-xl active:scale-95 transform flex items-center justify-center gap-2"
        >
          {cartItem ? 'Update Cart' : 'Add to Cart'}
        </button>
        {cart.length > 0 && (
          <button 
            onClick={() => navigate('/cart')}
            className="flex-none px-6 bg-violet-100 text-violet-700 font-bold py-4 rounded-2xl hover:bg-violet-200 transition border border-violet-200 active:scale-95"
          >
             <ShoppingCart size={24} />
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

       <div className="bg-white p-4 shadow-sm flex items-center sticky top-0 z-10 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 mr-2 rounded-full hover:bg-gray-100 active:scale-95 transition">
          <ArrowLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="text-xl font-bold flex-1 text-gray-900">My Cart <span className="text-gray-400 font-normal ml-1">({cart.length})</span></h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-32 text-gray-400">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
               <ShoppingCart size={40} className="text-gray-300"/>
            </div>
            <h3 className="text-lg font-bold text-gray-600 mb-1">Your cart is empty</h3>
            <p className="text-sm">Looks like you haven't added anything yet.</p>
            <button onClick={() => navigate('/')} className="mt-6 px-8 py-3 bg-violet-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition">
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.productId} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-start relative group">
                <ProductImage 
                   src={item.imageUrl} 
                   alt={item.productName} 
                   className="w-20 h-20 object-cover rounded-xl bg-gray-50 flex-shrink-0"
                   iconSize={20}
                />
                
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-gray-800 text-sm line-clamp-2 leading-snug pr-6">{item.productName}</h3>
                     <button 
                       onClick={() => removeFromCart(item.productId)} 
                       className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition p-1"
                     >
                       <Trash2 size={18} />
                     </button>
                  </div>
                  
                  <div>
                    {item.sets > 0 ? (
                      <span className="inline-flex items-center bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-violet-100">
                        {item.sets} Set{item.sets > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 italic border-l-4 border-l-violet-300">
                        "{item.note}"
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
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
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
      <div className="bg-white p-4 shadow-sm flex items-center border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 mr-2 rounded-full hover:bg-gray-100 active:scale-95 transition">
          <ArrowLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="p-5 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <RefreshCw size={18} className="text-violet-500" />
            Sync Status
          </h2>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
             <p className="text-sm text-gray-500 font-medium">Last Synced</p>
             <p className="text-lg font-bold text-gray-800">{lastSync || 'Never'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Settings size={18} className="text-gray-500" />
            Data Management
          </h2>
          <button 
            onClick={() => {
              if (window.confirm("Are you sure? This will delete all local data.")) {
                clearData();
                navigate('/');
              }
            }}
            className="w-full py-4 border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 font-bold transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            Clear Cache & Data
          </button>
          <p className="text-xs text-gray-400 mt-3 text-center">
            This action removes all downloaded images and cart items.
          </p>
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
