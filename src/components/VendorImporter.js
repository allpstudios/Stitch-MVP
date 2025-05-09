import React, { useState } from 'react';
import { importVendors } from '../utils/vendorImport';
import Papa from 'papaparse';
import './VendorImporter.css';

const VendorImporter = () => {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setFile(file);
      setError(null);
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'companyName',
      'email',
      'phoneNumber',
      'address',
      'website',
      'bio',
      'moq',
      'clients',
      'categories',
      'services',
      'specializations',
      'instagram',
      'tiktok',
      'facebook'
    ];

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "vendor_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = () => {
    setLoading(true);
    setError(null);
    setResults(null);

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const importResults = await importVendors(results.data);
          setResults(importResults);
        } catch (error) {
          setError(error.message);
        } finally {
          setLoading(false);
        }
      },
      error: (error) => {
        setError('Error parsing CSV file: ' + error.message);
        setLoading(false);
      }
    });
  };

  return (
    <div className="vendor-importer">
      <h2>Import Vendors</h2>
      
      <div className="template-section">
        <h3>1. Download Template</h3>
        <p>Start by downloading our CSV template:</p>
        <button onClick={downloadTemplate} className="download-btn">
          Download Template
        </button>
      </div>

      <div className="upload-section">
        <h3>2. Upload Completed CSV</h3>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="file-input"
        />
        {file && (
          <button 
            onClick={handleImport} 
            disabled={loading}
            className="import-btn"
          >
            {loading ? 'Importing...' : 'Import Vendors'}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {results && (
        <div className="results-section">
          <h3>Import Results</h3>
          
          <div className="successful-imports">
            <h4>Successfully Imported ({results.successful.length})</h4>
            {results.successful.map((vendor, index) => (
              <div key={index} className="result-item success">
                <p><strong>{vendor.companyName}</strong></p>
                <p>Email: {vendor.email}</p>
                <p>Temporary Password: {vendor.tempPassword}</p>
              </div>
            ))}
          </div>

          {results.failed.length > 0 && (
            <div className="failed-imports">
              <h4>Failed Imports ({results.failed.length})</h4>
              {results.failed.map((vendor, index) => (
                <div key={index} className="result-item error">
                  <p><strong>{vendor.companyName}</strong></p>
                  <p>Email: {vendor.email}</p>
                  <p>Error: {vendor.error}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorImporter; 