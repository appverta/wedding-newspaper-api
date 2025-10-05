import React, { useState, useEffect } from 'react';
import TagManager from 'react-gtm-module';
import './App.css';

// Initialize GTM
const tagManagerArgs = {
  gtmId: 'GTM-54WR47S7'
};

// Analytics helper functions
const trackEvent = (eventName, parameters = {}) => {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...parameters,
      timestamp: new Date().toISOString()
    });
  }
  console.log('Analytics Event:', eventName, parameters);
};

function App() {
  const [currentStep, setCurrentStep] = useState('access');
  const [accessCode, setAccessCode] = useState('');
  const [isValidCode, setIsValidCode] = useState(false);
  const [formData, setFormData] = useState({
    bride: '',
    groom: '',
    weddingDate: '',
    venue: '',
    howMet: '',
    proposal: '',
    favoriteMemory: '',
    sharedHobbies: '',
    petNames: '',
    futurePlans: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [startTime, setStartTime] = useState(null);

  // Initialize GTM and tracking
  useEffect(() => {
    // Initialize GTM
    TagManager.initialize(tagManagerArgs);
    
    // Track page load
    trackEvent('page_view', {
      page_title: 'AI Wedding Newspaper Generator',
      page_location: window.location.href
    });
    
    trackEvent('session_start');
    setStartTime(Date.now());
  }, []);

  const handleAccessCodeSubmit = async (e) => {
    e.preventDefault();
    
    trackEvent('access_code_attempt', { 
      code_length: accessCode.length 
    });

    try {
      const response = await fetch('https://wedding-newspaper-backend.onrender.com/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessCode }),
      });

      if (response.ok) {
        setIsValidCode(true);
        setCurrentStep('form');
        trackEvent('access_code_success', { access_code: accessCode });
        trackEvent('form_start', { form_name: 'wedding_details' });
      } else {
        trackEvent('access_code_error', { error_type: 'invalid_code' });
        alert('Invalid access code. Please check your code and try again.');
      }
    } catch (error) {
      trackEvent('access_code_error', { error_type: 'network_error' });
      alert('Network error. Please try again.');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (value.trim().length > 0) {
      trackEvent('form_field_complete', { field_name: field });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    const requiredFields = ['bride', 'groom', 'weddingDate', 'venue', 'howMet'];
    const missingFields = requiredFields.filter(field => !formData[field].trim());
    
    if (missingFields.length > 0) {
      trackEvent('form_validation_error', { missing_fields: missingFields });
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    trackEvent('form_submit_attempt');
    setIsGenerating(true);
    setCurrentStep('generating');

    try {
      const response = await fetch('https://wedding-newspaper-backend.onrender.com/generate-newspaper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, accessCode }),
      });

      if (response.ok) {
        const result = await response.json();
        setGeneratedContent(result);
        setCurrentStep('complete');
        
        trackEvent('form_complete');
        trackEvent('newspaper_generated', { access_code: accessCode });
      } else {
        throw new Error('Generation failed');
      }
    } catch (error) {
      trackEvent('generation_error', { error_message: error.message });
      alert('Error generating newspaper. Please try again.');
      setCurrentStep('form');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    trackEvent('pdf_download_attempt');
    
    try {
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(generatedContent, null, 2)], {type: 'application/json'});
      element.href = URL.createObjectURL(file);
      element.download = `wedding-newspaper-${formData.bride}-${formData.groom}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
      trackEvent('pdf_download_success');
      trackEvent('purchase', {
        transaction_id: accessCode,
        value: 15.99,
        currency: 'USD'
      });
      
    } catch (error) {
      trackEvent('pdf_download_error', { error_message: error.message });
      alert('Error downloading file. Please try again.');
    }
  };

  // Your existing JSX code stays the same...
  // Access Code Step
  if (currentStep === 'access') {
    return (
      <div className="App">
        <div className="container">
          <div className="header">
            <h1>🎉 AI Wedding Newspaper Generator</h1>
            <p className="subtitle">Create your personalized wedding newspaper in minutes!</p>
          </div>

          <div className="access-form">
            <h2>Enter Your Access Code</h2>
            <p>Please enter the unique access code you received with your purchase.</p>
            
            <form onSubmit={handleAccessCodeSubmit}>
              <div className="form-group">
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="Enter your access code (e.g., WN-ABC123)"
                  className="access-input"
                  required
                />
              </div>
              <button type="submit" className="submit-btn">
                Continue
              </button>
            </form>

            <div className="help-section">
              <h3>Need Help?</h3>
              <p>• Check your Etsy messages for your access code</p>
              <p>• Access codes are in format: WN-ABC123</p>
              <p>• Contact us through Etsy if you can't find your code</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Add your other steps (form, generating, complete) here...
  return <div>Loading...</div>;
}

export default App;
