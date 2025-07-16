import React, { useState, useEffect } from 'react';
import { getAPIConfig, saveAPIConfig, validateAPIUrl } from '../../game/helpers/apiService';
import styles from './APIConfig.module.css';

interface APIConfigProps {
  onConfigSaved: () => void;
}

export const APIConfig: React.FC<APIConfigProps> = ({ onConfigSaved }) => {
  const [apiUrl, setApiUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'valid' | 'invalid' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const config = getAPIConfig();
    setApiUrl(config.baseUrl);
  }, []);

  const handleValidateAndSave = async () => {
    if (!apiUrl.trim()) {
      setError('Please enter an API URL');
      return;
    }

    setIsValidating(true);
    setError(null);
    setValidationResult(null);

    try {
      const isValid = await validateAPIUrl(apiUrl);
      
      if (isValid) {
        saveAPIConfig({ baseUrl: apiUrl });
        setValidationResult('valid');
        onConfigSaved();
      } else {
        setValidationResult('invalid');
        setError('Could not connect to the API. Please check the URL and try again.');
      }
    } catch (err) {
      setValidationResult('invalid');
      setError(err instanceof Error ? err.message : 'Failed to validate API URL');
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidateAndSave();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>API Configuration</h2>
        <p>Enter the URL of your songs API server:</p>
        
        <div className={styles.inputContainer}>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="http://localhost:3000"
            className={styles.urlInput}
          />
          <button 
            onClick={handleValidateAndSave}
            disabled={isValidating}
            className={styles.validateButton}
          >
            {isValidating ? 'Validating...' : 'Save & Validate'}
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {validationResult === 'valid' && (
          <div className={styles.success}>
            ✓ API connection successful!
          </div>
        )}

        {validationResult === 'invalid' && (
          <div className={styles.error}>
            ✗ Cannot connect to API
          </div>
        )}

        <div className={styles.info}>
          <h3>Default API Endpoints:</h3>
          <ul>
            <li><code>GET /songs</code> - List songs with pagination</li>
            <li><code>GET /songs/search</code> - Search songs</li>
            <li><code>GET /health</code> - API health check</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
