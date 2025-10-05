import React, { useState, useEffect } from 'react';
import './App.css';

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

const trackPurchase = (transactionId, value) => {
  trackEvent('purchase', {
    ecommerce: {
      transaction_id: transactionId,
      value: value,
      currency: 'USD',
      items: [{
        item_id: 'wedding-newspaper-template',
        item_name: 'AI Wedding Newspaper Template',
        category: 'Digital Template',
        quantity: 1,
        price: value
      }]
    }
  });
};

const trackFormProgress = (step, data = {}) => {
  trackEvent('form_progress', {
    step: step,
    form_name: 'wedding_details',
    ...data
  });
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

  // Track page load and session start
  useEffect(() => {
    trackEvent('page_view', {
      page_title: 'AI Wedding Newspaper Generator',
      page_location: window.location.href
    });
    
    trackEvent('session_start');
    setStartTime(Date.now());

    // Track time on page milestones
    const timeTrackers = [
      setTimeout(() => trackEvent('time_on_page', { duration: '30_seconds' }), 30000),
      setTimeout(() => trackEvent('time_on_page', { duration: '2_minutes' }), 120000),
      setTimeout(() => trackEvent('time_on_page', { duration: '5_minutes' }), 300000)
    ];

    // Track scroll depth
    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (scrollPercent >= 25 && !window.scrollTracked25) {
        trackEvent('scroll_depth', { percent: 25 });
        window.scrollTracked25 = true;
      }
      if (scrollPercent >= 50 && !window.scrollTracked50) {
        trackEvent('scroll_depth', { percent: 50 });
        window.scrollTracked50 = true;
      }
      if (scrollPercent >= 75 && !window.scrollTracked75) {
        trackEvent('scroll_depth', { percent: 75 });
        window.scrollTracked75 = true;
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      timeTrackers.forEach(clearTimeout);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleAccessCodeSubmit = async (e) => {
    e.preventDefault();
    
    trackEvent('access_code_attempt', { 
      code_length: accessCode.length,
      attempt_time: Date.now() - startTime 
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
        trackEvent('access_code_success', { 
          access_code: accessCode,
          validation_time: Date.now() - startTime 
        });
        trackEvent('form_start', { form_name: 'wedding_details' });
      } else {
        trackEvent('access_code_error', { 
          error_type: 'invalid_code',
          access_code: accessCode 
        });
        alert('Invalid access code. Please check your code and try again.');
      }
    } catch (error) {
      trackEvent('access_code_error', { 
        error_type: 'network_error',
        error_message: error.message 
      });
      alert('Network error. Please try again.');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Track form field completion
    if (value.trim().length > 0) {
      trackEvent('form_field_complete', { 
        field_name: field,
        field_length: value.length 
      });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredFields = ['bride', 'groom', 'weddingDate', 'venue', 'howMet'];
    const missingFields = requiredFields.filter(field => !formData[field].trim());
    
    if (missingFields.length > 0) {
      trackEvent('form_validation_error', { 
        missing_fields: missingFields,
        completed_fields: Object.keys(formData).filter(key => formData[key].trim())
      });
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    trackEvent('form_submit_attempt', {
      form_completion_time: Date.now() - startTime,
      total_characters: Object.values(formData).join('').length
    });

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
        
        trackEvent('form_complete', {
          generation_time: Date.now() - startTime,
          content_length: JSON.stringify(result).length
        });
        
        trackEvent('newspaper_generated', {
          access_code: accessCode,
          total_time: Date.now() - startTime
        });
      } else {
        throw new Error('Generation failed');
      }
    } catch (error) {
      trackEvent('generation_error', {
        error_message: error.message,
        form_data_length: JSON.stringify(formData).length
      });
      alert('Error generating newspaper. Please try again.');
      setCurrentStep('form');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    trackEvent('pdf_download_attempt');
    
    try {
      // Create and download PDF
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(generatedContent, null, 2)], {type: 'application/json'});
      element.href = URL.createObjectURL(file);
      element.download = `wedding-newspaper-${formData.bride}-${formData.groom}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
      trackEvent('pdf_download_success');
      trackPurchase(accessCode, 15.99);
      
      // Track conversion completion
      trackEvent('conversion_complete', {
        total_time: Date.now() - startTime,
        access_code: accessCode,
        customer_names: `${formData.bride} & ${formData.groom}`
      });
      
    } catch (error) {
      trackEvent('pdf_download_error', {
        error_message: error.message
      });
      alert('Error downloading file. Please try again.');
    }
  };

  const handleButtonClick = (buttonName, additionalData = {}) => {
    trackEvent('button_click', {
      button_name: buttonName,
      current_step: currentStep,
      ...additionalData
    });
  };

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
              <button 
                type="submit" 
                className="submit-btn"
                onClick={() => handleButtonClick('submit_access_code', { code_length: accessCode.length })}
              >
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

  // Form Step
  if (currentStep === 'form') {
    return (
      <div className="App">
        <div className="container">
          <div className="header">
            <h1>✨ Tell Us Your Love Story</h1>
            <p className="subtitle">Answer these questions to create your personalized newspaper</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{width: '33%'}}></div>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="wedding-form">
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Bride's Name *</label>
                  <input
                    type="text"
                    value={formData.bride}
                    onChange={(e) => handleInputChange('bride', e.target.value)}
                    placeholder="Enter bride's name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Groom's Name *</label>
                  <input
                    type="text"
                    value={formData.groom}
                    onChange={(e) => handleInputChange('groom', e.target.value)}
                    placeholder="Enter groom's name"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Wedding Date *</label>
                  <input
                    type="date"
                    value={formData.weddingDate}
                    onChange={(e) => handleInputChange('weddingDate', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Wedding Venue *</label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => handleInputChange('venue', e.target.value)}
                    placeholder="e.g., Central Park, New York"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Your Love Story</h3>
              
              <div className="form-group">
                <label>How did you meet? *</label>
                <textarea
                  value={formData.howMet}
                  onChange={(e) => handleInputChange('howMet', e.target.value)}
                  placeholder="Tell us the story of how you first met..."
                  rows="3"
                  required
                />
              </div>

              <div className="form-group">
                <label>How did the proposal happen?</label>
                <textarea
                  value={formData.proposal}
                  onChange={(e) => handleInputChange('proposal', e.target.value)}
                  placeholder="Share the proposal story..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>What's your favorite memory together?</label>
                <textarea
                  value={formData.favoriteMemory}
                  onChange={(e) => handleInputChange('favoriteMemory', e.target.value)}
                  placeholder="Describe a special moment you shared..."
                  rows="3"
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Fun Details</h3>
              
              <div className="form-group">
                <label>What hobbies do you enjoy together?</label>
                <input
                  type="text"
                  value={formData.sharedHobbies}
                  onChange={(e) => handleInputChange('sharedHobbies', e.target.value)}
                  placeholder="e.g., hiking, cooking, traveling"
                />
              </div>

              <div className="form-group">
                <label>Do you have pet names for each other?</label>
                <input
                  type="text"
                  value={formData.petNames}
                  onChange={(e) => handleInputChange('petNames', e.target.value)}
                  placeholder="e.g., Honey, Babe, etc."
                />
              </div>

              <div className="form-group">
                <label>What are your plans for the future?</label>
                <textarea
                  value={formData.futurePlans}
                  onChange={(e) => handleInputChange('futurePlans', e.target.value)}
                  placeholder="Dreams, goals, or plans you have together..."
                  rows="3"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              onClick={() => handleButtonClick('generate_newspaper', { 
                form_completion: Object.keys(formData).filter(key => formData[key].trim()).length 
              })}
            >
              Generate My Wedding Newspaper ✨
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Generating Step
  if (currentStep === 'generating') {
    return (
      <div className="App">
        <div className="container">
          <div className="generating-container">
            <div className="spinner"></div>
            <h2>Creating Your Personalized Newspaper...</h2>
            <p>Our AI is crafting your unique love story. This will take just a moment!</p>
            <div className="progress-bar">
              <div className="progress-fill animated" style={{width: '66%'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Complete Step
  if (currentStep === 'complete') {
    return (
      <div className="App">
        <div className="container">
          <div className="success-container">
            <div className="success-animation">
              <div className="checkmark">✓</div>
            </div>
            <h1>🎉 Your Wedding Newspaper is Ready!</h1>
            <p className="success-subtitle">Your personalized newspaper has been generated successfully!</p>
            
            <div className="newspaper-preview">
              <h3>Preview of Your Newspaper:</h3>
              <div className="preview-content">
                <h4>📰 The {formData.bride} & {formData.groom} Times</h4>
                <p><strong>Wedding Date:</strong> {formData.weddingDate}</p>
                <p><strong>Venue:</strong> {formData.venue}</p>
                <div className="preview-section">
                  <h5>Love Story Headline:</h5>
                  <p>"{formData.bride} and {formData.groom} Tie the Knot in Beautiful Ceremony"</p>
                </div>
              </div>
            </div>

            <div className="download-section">
              <button 
                onClick={handleDownload} 
                className="download-btn"
                onClick={() => handleButtonClick('download_pdf')}
              >
                📥 Download Your Newspaper PDF
              </button>
              <p className="download-note">
                High-resolution PDF ready for printing • Perfect for 11" x 17" paper
              </p>
            </div>

            <div className="sharing-section">
              <h3>Love your newspaper?</h3>
              <p>Share your experience and help other couples discover this unique wedding idea!</p>
              <div className="social-buttons">
                <button 
                  className="social-btn facebook"
                  onClick={() => handleButtonClick('share_facebook')}
                >
                  Share on Facebook
                </button>
                <button 
                  className="social-btn instagram"
                  onClick={() => handleButtonClick('share_instagram')}
                >
                  Share on Instagram
                </button>
              </div>
            </div>

            <div className="support-section">
              <h3>Need Help?</h3>
              <p>If you have any questions about printing or using your newspaper, please contact us through Etsy. We're here to help make your wedding day perfect!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
