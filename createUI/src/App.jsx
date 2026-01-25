import useUIStore from './store/uiStore';
import ImageUpload from './components/ImageUpload/ImageUpload';
import UIEditor from './components/UIEditor/UIEditor';
import ExportPanel from './components/Export/ExportPanel';
import './App.css';

const STEPS = [
  { id: 0, label: '导入', icon: '📋' },
  { id: 1, label: '编辑', icon: '✏️' },
  { id: 2, label: '导出', icon: '📦' },
];

function App() {
  const { currentStep } = useUIStore();

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <ImageUpload />;
      case 1:
        return <UIEditor />;
      case 2:
        return <ExportPanel />;
      default:
        return <ImageUpload />;
    }
  };

  return (
    <div className="app">
      {/* Progress Steps - Show on import page only */}
      {currentStep === 0 && (
        <div className="app-steps">
          {STEPS.map((step, index) => (
            <div key={step.id} className="step-wrapper">
              <div
                className={`step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''
                  }`}
              >
                <span className="step-number">
                  {currentStep > step.id ? '✓' : step.icon}
                </span>
                <span className="step-label">{step.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`step-connector ${currentStep > step.id ? 'completed' : ''}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="app-content">
        {renderStep()}
      </div>
    </div>
  );
}

export default App;
