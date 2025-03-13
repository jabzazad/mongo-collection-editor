import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

const CollectionNode = ({ data }) => {
  const [expandedFields, setExpandedFields] = useState({});

  const toggleField = (fieldName) => {
    setExpandedFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const renderField = (fieldName, fieldData, level = 0) => {
    const isExpanded = expandedFields[fieldName];
    const indent = level * 20;

    return (
      <div key={fieldName} style={{ marginLeft: `${indent}px` }}>
        <div className="field-row">
          {fieldData.isExpandable && (
            <div 
              className="nested-indicator" 
              onClick={() => toggleField(fieldName)}
              style={{ cursor: 'pointer' }}
            >
              {isExpanded ? '▼' : '▶'}
            </div>
          )}
          <div 
            className={`field-name ${fieldData.isExpandable ? 'nested-field' : ''}`}
            onClick={() => fieldData.isExpandable && toggleField(fieldName)}
            style={{ cursor: fieldData.isExpandable ? 'pointer' : 'default' }}
          >
            {fieldName}
          </div>
          <div className="field-type">{fieldData.type}</div>
        </div>
        
        {isExpanded && fieldData.isExpandable && fieldData.content && (
          <div className="nested-content">
            {Object.entries(fieldData.content).map(([key, value]) => 
              renderField(key, value, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="collection-node parent-collection">
      <div className="collection-header">{data.label}</div>
      <div className="collection-content">
        {Object.entries(data.fields).map(([fieldName, fieldData]) => 
          renderField(fieldName, fieldData)
        )}
      </div>
    </div>
  );
};


const nodeTypes = {
  collection: CollectionNode
};

const encodeData = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    const base64 = btoa(encodeURIComponent(jsonString));
    return base64;
  } catch (error) {
    console.error('Error encoding data:', error);
    return null;
  }
};

const decodeData = (encoded) => {
  try {
    const jsonString = decodeURIComponent(atob(encoded));
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error decoding data:', error);
    return null;
  }
};

const generateShareUrl = (jsonData, collectionName) => {
  const data = {
    json: jsonData,
    collection: collectionName
  };
  const encoded = encodeData(data);
  if (encoded) {
    return `${window.location.origin}${window.location.pathname}?data=${encoded}`;
  }
  return null;
};

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      console.log('URL copied to clipboard');
    })
    .catch(err => {
      console.error('Failed to copy URL:', err);
    });
};

function App() {
  const [schema, setSchema] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const [isInputValid, setIsInputValid] = useState(true);
  const [realtimeUpdate, setRealtimeUpdate] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedView, setExpandedView] = useState(true);
  const [collectionName, setCollectionName] = useState('personal');
  const jsonDebounceTimer = useRef(null);
  const diagramPanelRef = useRef(null);
  const originalJsonData = useRef(null);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareToast, setShowShareToast] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedData = params.get('data');
    
    if (encodedData) {
      const decodedData = decodeData(encodedData);
      if (decodedData) {
        setJsonInput(JSON.stringify(decodedData.json, null, 2));
        setCollectionName(decodedData.collection || 'personal');
        processJsonToERD(decodedData.json);
      }
    } else {
      async function fetchSampleData() {
        try {
          const response = await fetch('/data/test-data.json');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setJsonInput(JSON.stringify(data, null, 2));
          processJsonToERD(data);
          originalJsonData.current = data;
        } catch (error) {
          console.error('Error loading sample JSON data:', error);
          setJsonInput('{\n  "sample": "Paste your JSON here"\n}');
        }
      }
      
      fetchSampleData();
    }
  }, []);
  
  useEffect(() => {

    if (!realtimeUpdate) return;
    
    if (jsonDebounceTimer.current) {
      clearTimeout(jsonDebounceTimer.current);
    }
    
    jsonDebounceTimer.current = setTimeout(() => {
      if (jsonInput.trim() && isInputValid) {
        try {
          const jsonData = JSON.parse(jsonInput);
          setIsUpdating(true);
          originalJsonData.current = jsonData;
          processJsonToERD(jsonData);
          
          setTimeout(() => {
            setIsUpdating(false);
          }, 1000);
        } catch (error) {
        }
      }
    }, 800);
    
    return () => {
      if (jsonDebounceTimer.current) {
        clearTimeout(jsonDebounceTimer.current);
      }
    };
  }, [jsonInput, isInputValid, realtimeUpdate]);
  
  useEffect(() => {
    if (!diagramPanelRef.current) return;
    
    if (isUpdating) {
      diagramPanelRef.current.classList.add('diagram-updating');
    } else {
      diagramPanelRef.current.classList.remove('diagram-updating');
    }
  }, [isUpdating]);

  useEffect(() => {
    if (originalJsonData.current) {
      processJsonToERD(originalJsonData.current);
    }
  }, [expandedView]);
  
  const validateJson = (jsonString) => {
    try {
      JSON.parse(jsonString);
      setIsInputValid(true);
      setError('');
      return true;
    } catch (e) {
      setIsInputValid(false);
      setError(`JSON ไม่ถูกต้อง: ${e.message}`);
      return false;
    }
  };
  
  const handleJsonInputChange = (e) => {
    const input = e.target.value;
    setJsonInput(input);
    
    if (input.trim()) {
      validateJson(input);
    } else {
      setIsInputValid(true);
      setError('');
    }
  };
  
  const toggleRealtimeUpdate = () => {
    setRealtimeUpdate(prev => !prev);
  };
  
  const toggleExpandedView = () => {
    setExpandedView(prev => !prev);
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
    }, 1000);
  };
  
  const analyzeJsonStructure = (jsonData) => {
    const collections = {};
    
    const mainCollectionName = 'personal';
    collections[mainCollectionName] = {};
    
    analyzeFieldTypes(jsonData, collections[mainCollectionName], true);

    return collections;
  };

  const analyzeFieldTypes = (obj, targetSchema, isRoot = false) => {
    const fields = {};
    
    for (const key in obj) {
      const value = obj[key];
      
      if (value === null) {
        fields[key] = { type: 'null', isExpandable: false };
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === 'object') {
            fields[key] = {
              type: 'Array<Object>',
              isExpandable: true,
              content: analyzeFieldTypes(value[0]),
              isArray: true
            };
          } else if (value.length > 0) {
            fields[key] = {
              type: `Array<${typeof value[0]}>`,
              isExpandable: false
            };
          } else {
            fields[key] = { type: 'Array', isExpandable: false };
          }
        } else {
          fields[key] = {
            type: 'Object',
            isExpandable: true,
            content: analyzeFieldTypes(value),
            isObject: true
          };
        }
      } else {
        fields[key] = { type: typeof value, isExpandable: false };
      }
    }
    
    return fields;
  };

  const findEmbeddedCollections = (jsonData, collections, parentCollection = null) => {

    const potentialEmbeddedCollections = [
      'status_histories', 'documents', 'wtSku', 'skills', 'benefits', 
      'company', 'location', 'details', 'requirements', 'contacts'
    ];
    
    for (const key in jsonData) {
      const value = jsonData[key];
      
      if (value !== null && typeof value === 'object') {
        const isPotentialCollection = potentialEmbeddedCollections.includes(key) || 
                                     (key.endsWith('s') && !key.endsWith('status'));
        
        if (Array.isArray(value)) {
          if (value.length > 0 && typeof value[0] === 'object' && isPotentialCollection) {
            const collectionName = key;
            
             if (parentCollection && collections[parentCollection]) {
              collections[parentCollection][`${key}_ref`] = true;
            }
            
            collections[collectionName] = {};
            analyzeFieldTypes(value[0], collections[collectionName]);
            
            if (parentCollection) {
              collections[collectionName]._parentCollection = parentCollection;
              collections[collectionName]._relationType = 'child';
              collections[collectionName]._relationField = key;
            }
          }
        } else if (Object.keys(value).length > 0) {
           if (isPotentialCollection) {
            const collectionName = key;
            
             if (parentCollection && collections[parentCollection]) {
              collections[parentCollection][`${key}_ref`] = true;
            }
            
            collections[collectionName] = {};
            analyzeFieldTypes(value, collections[collectionName]);
            
           if (parentCollection) {
              collections[collectionName]._parentCollection = parentCollection;
              collections[collectionName]._relationType = 'child';
              collections[collectionName]._relationField = key;
            }
            
           findEmbeddedCollections(value, collections, collectionName);
          }
        }
      }
    }
  };

  const findPotentialReferences = (collections) => {
    const references = [];
    
       Object.keys(collections).forEach(sourceCollection => {
      const fields = collections[sourceCollection];
      
      if (fields._parentCollection) {
        const relationType = fields._relationType || 'embedded';
        const relationField = fields._relationField || sourceCollection;
        
        references.push({
          source: fields._parentCollection,
          target: sourceCollection,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          isParentChild: true,
          label: `has ${relationField}`,
          data: {
            relationType: relationType 
          }
        });
      }
      
      Object.keys(fields).forEach(fieldName => {
        if (fieldName === '_parentCollection' || fieldName === '_relationType' || fieldName === '_relationField') return;
        
        if ((fieldName.endsWith('_id') || fieldName.endsWith('_uuid') || 
             fieldName.endsWith('Id')) && fieldName !== '_id') {
          
          let targetCollection = '';
          
          if (fieldName.endsWith('_id')) {
            targetCollection = fieldName.replace('_id', '');
          } else if (fieldName.endsWith('_uuid')) {
            targetCollection = fieldName.replace('_uuid', '');
          } else if (fieldName.endsWith('Id')) {
            targetCollection = fieldName.substring(0, fieldName.length - 2).toLowerCase();
          }
          
          if (collections[targetCollection]) {
            references.push({
              source: sourceCollection,
              target: targetCollection,
              sourceHandle: 'right',
              targetHandle: 'left',
              isParentChild: false,
              label: `${fieldName} → _id`,
              data: {
                relationType: 'reference'
              }
            });
          }
        }
        
         Object.keys(collections).forEach(potentialTarget => {
          if (
            sourceCollection !== potentialTarget && 
            (fieldName === potentialTarget || 
             fieldName === `${potentialTarget}_id` || 
             fieldName === `${potentialTarget}_uuid` ||
             fieldName.toLowerCase() === potentialTarget.toLowerCase())
          ) {
            const hasParentChild = references.some(ref => 
              (ref.source === sourceCollection && ref.target === potentialTarget && ref.isParentChild) ||
              (ref.source === potentialTarget && ref.target === sourceCollection && ref.isParentChild)
            );
            
            if (!hasParentChild) {
              references.push({
                source: sourceCollection,
                target: potentialTarget,
                sourceHandle: 'right',
                targetHandle: 'left',
                isParentChild: false,
                label: fieldName,
                data: {
                  relationType: 'reference'
                }
              });
            }
          }
        });
      });
    });
    
    return references;
  };

  const processJsonToERD = useCallback((jsonData) => {
    if (!jsonData) return;
    
    try {
      const newNodes = [{
        id: collectionName,
        type: 'collection',
        position: { x: 100, y: 100 },
        data: {
          label: collectionName,
          fields: analyzeFieldTypes(jsonData),
          isChildNode: false,
          id: collectionName
        }
      }];

      setNodes(newNodes);
      setEdges([]);
    } catch (error) {
      console.error('Error processing JSON:', error);
    }
  }, [setNodes, setEdges, collectionName]);
  
  const generateERD = () => {
    if (!jsonInput.trim()) {
      setError('กรุณาใส่ข้อมูล JSON');
      return;
    }
    
    if (!validateJson(jsonInput)) {
      return;
    }
    
    try {
      const jsonData = JSON.parse(jsonInput);
      setIsUpdating(true);
      originalJsonData.current = jsonData;
      processJsonToERD(jsonData);
      
      setTimeout(() => {
        setIsUpdating(false);
      }, 1000);
    } catch (error) {
      setError(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };
  
 const formatJson = () => {
    if (!jsonInput.trim()) return;
    
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setIsInputValid(true);
      setError('');
    } catch (error) {
      setError(`JSON ไม่ถูกต้อง: ${error.message}`);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedData = params.get('data');
    
    if (encodedData) {
      const decodedData = decodeData(encodedData);
      if (decodedData) {
        setJsonInput(JSON.stringify(decodedData.json, null, 2));
        setCollectionName(decodedData.collection || 'personal');
        processJsonToERD(decodedData.json);
      }
    }
  }, []);

  const handleShare = () => {
    try {
      const jsonData = JSON.parse(jsonInput);
      const url = generateShareUrl(jsonData, collectionName);
      if (url) {
        setShareUrl(url);
        copyToClipboard(url);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
      }
    } catch (error) {
      setError('ไม่สามารถแชร์ได้: JSON ไม่ถูกต้อง');
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title">Mongo Collection Editor</div>
      </header>
      
      <div className="main-content">
        <div className="json-editor-panel">
          <div className="panel-header">
            <h3>JSON Input</h3>
            <div className="panel-actions">
              <button className="action-btn" onClick={formatJson} title="Format JSON">
                🔧 จัดรูปแบบ
              </button>
              <button className="action-btn" onClick={handleShare} title="Share diagram">
                🔗 แชร์
              </button>
              <button className="primary-btn" onClick={generateERD}>
                แสดงแผนภาพ ER
              </button>
            </div>
          </div>
          
          <div className="json-editor-container">
            <div className="collection-name-input">
              <label htmlFor="collectionName">ชื่อคอลเลกชัน:</label>
              <input
                id="collectionName"
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="ใส่ชื่อคอลเลกชัน"
                className="collection-name-field"
              />
            </div>
            <textarea 
              className={`json-editor ${!isInputValid ? 'invalid' : ''}`}
              value={jsonInput}
              onChange={handleJsonInputChange}
              placeholder="Paste your JSON here..."
              spellCheck="false"
            />
            
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
        
        <div className="diagram-panel" ref={diagramPanelRef}>
          {realtimeUpdate && (
            <div className="realtime-status">
              {isUpdating ? '⚡️ กำลังอัปเดต...' : '🔄 อัปเดตแบบเรียลไทม์: เปิด'}
            </div>
          )}
          
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            className="dark-flow"
          >
            <Controls />
            <MiniMap 
              nodeColor={(node) => {
                return node.data.isChildNode ? '#1a4971' : '#2c593b';
              }}
            />
            <Background
              color="rgba(255, 255, 255, 0.05)"
              gap={12}
              size={1}
              variant="dots"
              style={{ backgroundColor: "#1e2939" }}
            />
            
            <Panel position="top-right" className="tools-panel">
              <div className="tools-container">
                <button 
                  className={`tool-btn ${realtimeUpdate ? 'active' : ''}`} 
                  title={realtimeUpdate ? "ปิดการอัปเดตอัตโนมัติ" : "เปิดการอัปเดตอัตโนมัติ"}
                  onClick={toggleRealtimeUpdate}
                >
                  <span className="realtime-icon">{realtimeUpdate ? '🔄' : '⏸️'}</span>
                </button>
                <button 
                  className={`tool-btn ${expandedView ? 'active' : ''}`} 
                  title={expandedView ? "มุมมองรวม" : "มุมมองขยาย"}
                  onClick={toggleExpandedView}
                >
                  <span className="layout-icon">{expandedView ? '📊' : '📋'}</span>
                </button>
                <button className="tool-btn" title="Filter diagram">
                  <span className="filter-icon">⚙️</span>
                </button>
                <button className="tool-btn" title="Toggle dark mode">
                  <span className="theme-icon">🌙</span>
                </button>
                <button className="tool-btn" title="Open help">
                  <span className="help-icon">❓</span>
                </button>
              </div>
            </Panel>
          </ReactFlow>
        </div>
        
        {showShareToast && (
          <div className="share-toast">
            คัดลอก URL สำหรับแชร์แล้ว!
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
