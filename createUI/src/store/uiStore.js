import { create } from 'zustand';

// Load API key from environment variable (configured in .env file)
const getApiKey = () => {
  return import.meta.env.VITE_MINIMAX_API_KEY || '';
};


// UI Element Types supported by Unity UI Toolkit
export const UI_ELEMENT_TYPES = {
  VISUAL_ELEMENT: 'VisualElement',
  BUTTON: 'Button',
  LABEL: 'Label',
  IMAGE: 'Image',
  PROGRESS_BAR: 'ProgressBar',
  SCROLL_VIEW: 'ScrollView',
  TEXT_FIELD: 'TextField',
  SLIDER: 'Slider',
  TOGGLE: 'Toggle',
  FOLDOUT: 'Foldout',
};

// Default element properties
const createDefaultElement = (type, overrides = {}) => ({
  id: `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)} `,
  type,
  name: type.toLowerCase(),
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  styles: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    color: '#ffffff',
    fontSize: 14,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    opacity: 1,
    flexGrow: 0,
    flexShrink: 1,
    alignItems: (type === 'Button' || type === 'Label') ? 'center' : 'auto',
    justifyContent: (type === 'Button' || type === 'Label') ? 'center' : 'flex-start',
    flexDirection: 'column',
  },
  text: type === 'Button' ? 'Button' : type === 'Label' ? 'Label Text' : '',
  children: [],
  parentId: null,
  ...overrides,
});

// Main UI Store
const useUIStore = create((set, get) => ({
  // Current step in the workflow
  currentStep: 0, // 0: Import, 1: Edit, 2: Export

  // UI Elements
  elements: [],
  selectedElementId: null,

  // Canvas settings
  canvasWidth: 1024,
  canvasHeight: 480,
  canvasScale: 1,

  // Actions
  setStep: (step) => set({ currentStep: step }),

  setCanvasSize: (width, height) => set({
    canvasWidth: width,
    canvasHeight: height,
  }),

  // Element operations
  setElements: (elements) => set({ elements }),

  addElement: (type, overrides = {}) => {
    const newElement = createDefaultElement(type, overrides);
    set((state) => ({
      elements: [...state.elements, newElement],
      selectedElementId: newElement.id,
    }));
    return newElement;
  },

  updateElement: (id, updates) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    }));
  },

  updateElementStyle: (id, styleUpdates) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id
          ? { ...el, styles: { ...el.styles, ...styleUpdates } }
          : el
      ),
    }));
  },

  removeElement: (id) => {
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    }));
  },

  selectElement: (id) => set({ selectedElementId: id }),

  duplicateElement: (id) => {
    const state = get();
    const element = state.elements.find((el) => el.id === id);
    if (element) {
      const newElement = createDefaultElement(element.type, {
        ...element,
        id: undefined,
        x: element.x + 20,
        y: element.y + 20,
        name: `${element.name} _copy`,
      });
      set((state) => ({
        elements: [...state.elements, newElement],
        selectedElementId: newElement.id,
      }));
    }
  },

  moveElement: (id, x, y) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, x, y } : el
      ),
    }));
  },

  resizeElement: (id, width, height) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, width, height } : el
      ),
    }));
  },

  reparentElement: (childId, newParentId) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === childId ? { ...el, parentId: newParentId } : el
      ),
    }));
  },

  setCanvasScale: (scale) => set({ canvasScale: scale }),

  // Reset
  reset: () => set({
    currentStep: 0,
    elements: [],
    selectedElementId: null,
    canvasWidth: 1024,
    canvasHeight: 480,
    canvasScale: 1,
  }),
}));

export default useUIStore;
export { createDefaultElement };
