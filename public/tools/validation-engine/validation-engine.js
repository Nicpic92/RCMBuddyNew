// Import common utilities
import { showLoader, hideLoader, displayMessage } from '../../js/common-utils.js';
// Import auth functions (assuming auth.js is also a module or its functions are globally available via script tag)
// For this setup, since auth.js uses 'window.verifyAndSetupUser', we'll rely on global exposure.
// If auth.js were also an ES module, we'd do:
// import { verifyAndSetupUser, setupNavigation } from '../../js/auth.js';


// --- Global Variables ---
let parsedExcelData = null; // Stores the parsed data from the main Excel file
let parsedDataDictionaryRules = null; // Stores parsed rules from the selected data dictionary (e.g., from rules_json)
let validationRules = {}; // Stores validation rules extracted from the data dictionary in a usable format
let analysisResults = {}; // Stores the results of the analysis for each sheet

// Store the selected main file (from server or local)
let selectedMainFileBlob = null;
let selectedMainFileName = null;

// Overall stats for the report, now primarily for custom issues and duplicates
let overallStats = {
    customIssueCount: 0,
    duplicateRowCount: 0,
    totalProcessedCells: 0, // Renamed for clarity on cells checked for custom rules
    totalProcessedRowsForDuplicates: 0 // Renamed for clarity on rows checked for duplicates
};

const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0); // Normalize today's date for comparison

// --- Helper Functions (Now imported from common-utils.js) ---
// showLoader, hideLoader, displayMessage are now imported.
// The displayMessage in common-utils.js is slightly more robust with default color.

/**
 * Updates the overall counts display. Now focuses on custom issues and duplicates.
 */
function updateInitialOverallCountsDisplay() {
    document.getElementById('totalBlankCellsDisplay').textContent = `Total Blank Cells (standard check disabled): 0`;
    document.getElementById('totalNullCountDisplay').textContent = `Total "NULL" Strings (standard check disabled): 0`;
    document.getElementById('totalFutureDatesDisplay').textContent = `Total Future Dates (standard check disabled): 0`;
    document.getElementById('totalDuplicateRowsDisplay').textContent = `Total Duplicate Rows Found: ${overallStats.duplicateRowCount}`;
    document.getElementById('totalCustomIssuesDisplay').textContent = `Total Custom Validation Issues Found: ${overallStats.customIssueCount}`;
}

// --- File and Data Dictionary Selection and Loading ---

/**
 * Populates the main file select dropdown (from company_files) and
 * the data dictionary select dropdown (from data_dictionaries).
 */
async function populateSelects() {
    const token = localStorage.getItem('jwtToken');
    if (!token) return;

    try {
        // --- Get general files (for main file selection) from list-files API ---
        const filesResponse = await fetch('/api/list-files', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!filesResponse.ok) {
            console.error('Failed to fetch general files:', filesResponse.statusText);
            displayMessage('mainFileStatus', 'Could not load uploaded files list.', 'error');
        }
        const filesResult = await filesResponse.json();
        const generalFiles = filesResult.files || [];


        // --- Get Data Dictionaries from NEW API ---
        const dictsResponse = await fetch('/api/list-data-dictionaries', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!dictsResponse.ok) {
            throw new Error(`Failed to fetch data dictionaries: ${dictsResponse.statusText}`);
        }
        const dictsResult = await dictsResponse.json();
        const dataDictionaries = dictsResult.dictionaries || [];


        const mainFileSelect = document.getElementById('mainFileSelect');
        const dataDictionarySelect = document.getElementById('dataDictionarySelect');

        // Clear existing options
        mainFileSelect.innerHTML = '<option value="">-- Select an Uploaded File --</option>';
        dataDictionarySelect.innerHTML = '<option value="">-- No Data Dictionary Selected --</option>';

        let hasMainFiles = false;
        let hasDataDictionaries = false;

        // Populate main file select (from generalFiles)
        generalFiles.forEach(file => {
            const optionMain = document.createElement('option');
            optionMain.value = file.id;
            optionMain.textContent = file.filename; // Uses 'filename' as returned by list-files.js
            mainFileSelect.appendChild(optionMain);
            hasMainFiles = true;
        });

        // Populate data dictionary select (from dataDictionaries)
        dataDictionaries.forEach(dict => {
            const optionDict = document.createElement('option');
            optionDict.value = dict.id;
            optionDict.textContent = dict.name; // Uses 'name' as returned by list-data-dictionaries.js
            dataDictionarySelect.appendChild(optionDict);
            hasDataDictionaries = true;
        });

        // Enable/disable selects and buttons based on fetched files
        if (!hasMainFiles) {
            mainFileSelect.innerHTML = '<option value="">No files uploaded yet.</option>';
            mainFileSelect.disabled = true;
            document.getElementById('loadMainFileBtn').disabled = true;
        } else {
            mainFileSelect.disabled = false;
            document.getElementById('loadMainFileBtn').disabled = false;
        }

        if (!hasDataDictionaries) {
            dataDictionarySelect.innerHTML = '<option value="">No data dictionaries available.</option>';
            dataDictionarySelect.disabled = true;
            document.getElementById('loadDataDictionaryBtn').disabled = true;
        } else {
            dataDictionarySelect.disabled = false;
            document.getElementById('loadDataDictionaryBtn').disabled = false;
        }

    } catch (error) {
        console.error('Error populating file/dictionary selects:', error);
        displayMessage('dataDictionaryStatus', 'Error loading lists. Please try again.', 'error');
    }
}

/**
 * Loads the selected main Excel/CSV file from the server for analysis.
 */
async function loadMainFile() {
    const selectedFileId = document.getElementById('mainFileSelect').value;
    if (!selectedFileId) {
        displayMessage('mainFileStatus', 'Please select a file to load from the uploaded list.', 'error');
        selectedMainFileBlob = null;
        selectedMainFileName = null;
        return;
    }

    displayMessage('mainFileStatus', 'Loading selected file...', 'info');
    const token = localStorage.getItem('jwtToken');

    try {
        // This uses the old get-file API for general files (from company_files)
        const response = await fetch(`/api/get-file?fileId=${selectedFileId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const fileDataJson = await response.json();
        // fileDataJson.fileData is base64 encoded from get-file.js
        const decodedFileData = atob(fileDataJson.fileData);
        const byteCharacters = decodedFileData.split('').map(char => char.charCodeAt(0));
        const byteArray = new Uint8Array(byteCharacters);

        selectedMainFileBlob = new Blob([byteArray], { type: fileDataJson.mimetype });
        selectedMainFileName = fileDataJson.filename;

        displayMessage('mainFileStatus', `File loaded: ${selectedMainFileName}`, 'success');

        // Clear the local file input if a server file is loaded
        document.getElementById('excelFile').value = '';

    } catch (error) {
        console.error('Error fetching main file:', error);
        displayMessage('mainFileStatus', 'Failed to load file. Please try again.', 'error');
        selectedMainFileBlob = null;
        selectedMainFileName = null;
    }
}

/**
 * Loads the selected data dictionary's rules from the new API.
 */
async function loadDataDictionary() {
    const selectedDictId = document.getElementById('dataDictionarySelect').value;
    if (!selectedDictId) {
        displayMessage('dataDictionaryStatus', 'Please select a data dictionary.', 'error');
        parsedDataDictionaryRules = null;
        validationRules = {};
        return;
    }

    displayMessage('dataDictionaryStatus', 'Loading data dictionary...', 'info');
    const token = localStorage.getItem('jwtToken');

    try {
        // Use the NEW get-data-dictionary API
        const response = await fetch(`/api/get-data-dictionary?id=${selectedDictId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const dictionaryContent = await response.json();
        // rules_json is now directly a JSON object from the new API
        const rulesData = dictionaryContent.rules_json;

        if (rulesData && Array.isArray(rulesData)) {
            parsedDataDictionaryRules = rulesData;
            extractValidationRules(parsedDataDictionaryRules);
            displayMessage('dataDictionaryStatus', `Data dictionary loaded: ${document.getElementById('dataDictionarySelect').options[document.getElementById('dataDictionarySelect').selectedIndex].text}`, 'success');
        } else {
            displayMessage('dataDictionaryStatus', 'Data dictionary content is invalid or empty.', 'error');
            parsedDataDictionaryRules = null;
            validationRules = {};
        }

    } catch (error) {
        console.error('Error fetching data dictionary:', error);
        displayMessage('dataDictionaryStatus', 'Failed to load data dictionary. Please try again.', 'error');
        parsedDataDictionaryRules = null;
        validationRules = {};
    }
}

/**
 * Transforms the raw data dictionary rules into a usable `validationRules` object
 * keyed by column name.
 */
function extractValidationRules(dataDictionaryRules) {
    validationRules = {}; // Reset rules
    if (!dataDictionaryRules || dataDictionaryRules.length === 0) {
        console.warn("Data dictionary has no rules defined.");
        return;
    }

    dataDictionaryRules.forEach(rule => {
        const columnName = rule['Column Name'] ? String(rule['Column Name']).trim() : null;
        if (columnName) {
            if (!validationRules[columnName]) {
                validationRules[columnName] = [];
            }
            validationRules[columnName].push(rule);
        }
    });
    console.log("Extracted Validation Rules:", validationRules);
}

// --- Main File Analysis Logic (MODIFIED to only use custom rules and duplicates) ---

async function analyzeFile() {
    const fileInput = document.getElementById('excelFile');
    const localExcelFile = fileInput.files[0];
    const MAX_ROWS_TO_PROCESS = 5000; // Define the row limit

    let fileToAnalyze = null;
    let fileName = null;

    if (localExcelFile) {
        fileToAnalyze = localExcelFile;
        fileName = localExcelFile.name;
        selectedMainFileBlob = null;
        document.getElementById('mainFileSelect').value = '';
        displayMessage('mainFileStatus', '', 'info');
    } else if (selectedMainFileBlob) {
        fileToAnalyze = selectedMainFileBlob;
        fileName = selectedMainFileName;
        fileInput.value = '';
    } else {
        alert('Please select an Excel or CSV file to validate, either from your local machine or from your uploaded files.');
        return;
    }

    // Check if a data dictionary is loaded if custom rules are the only validation
    if (!parsedDataDictionaryRules || Object.keys(validationRules).length === 0) {
        alert('Please select and load a Data Dictionary to apply custom validation rules.');
        return;
    }


    if (!fileToAnalyze) {
        alert('No file available for analysis.');
        return;
    }

    showLoader('loader', ['analyzeFileBtn', 'loadMainFileBtn', 'loadDataDictionaryBtn']); // Using common-utils showLoader
    analysisResults = {}; // Reset results
    overallStats = { // Reset overall stats for each analysis
        customIssueCount: 0,
        duplicateRowCount: 0,
        totalProcessedCells: 0, // Renamed for clarity on cells checked for custom rules
        totalProcessedRowsForDuplicates: 0 // Renamed for clarity on rows checked for duplicates
    };

    document.getElementById('fileName').textContent = `File: ${fileName}`;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            parsedExcelData = XLSX.read(data, { type: 'array', cellNF: true, cellDates: false });

            document.getElementById('results').style.display = 'block';
            document.getElementById('sheetResults').innerHTML = '';

            parsedExcelData.SheetNames.forEach(sheetName => {
                const worksheet = parsedExcelData.Sheets[sheetName];
                // Get raw data, treating empty/missing cells as null
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval:null });

                if (jsonData.length === 0) return; // Skip empty sheets

                const sheetHeader = jsonData[0] || [];
                let sheetData = jsonData.slice(1); // All data rows (excluding header)

                // NEW: Apply row limit
                if (sheetData.length > MAX_ROWS_TO_PROCESS) {
                    console.warn(`Validation Tool: Sheet "${sheetName}" has ${sheetData.length} data rows. Processing only the first ${MAX_ROWS_TO_PROCESS} rows.`);
                    sheetData = sheetData.slice(0, MAX_ROWS_TO_PROCESS);
                    displayMessage('mainFileStatus', `Warning: Sheet "${sheetName}" exceeds ${MAX_ROWS_TO_PROCESS} rows. Only first ${MAX_ROWS_TO_PROCESS} rows processed.`, 'info');
                }


                const currentSheetIssues = {
                    customValidation: {}, // Stores custom rule violations per column
                    duplicateRows: [] // Stores row numbers of duplicates
                };

                // Update overallStats.totalProcessedRowsForDuplicates (for the *sheet*)
                if (sheetData.length > 0) {
                    overallStats.totalProcessedRowsForDuplicates += sheetData.length;
                }

                // --- Duplicate Rows Detection (RETAINED) ---
                // This applies to the entire row content across all cells in the row
                const seenRowStrings = new Map();
                sheetData.forEach((row, index) => {
                    // Create a string representation of the row for hashing, trimming each cell
                    const valStrings = row.map(cell => {
                        const val = (cell === null || cell === undefined) ? "" : String(cell);
                        return typeof val === 'string' ? val.trim() : val;
                    });
                    const rowString = valStrings.join('~!~'); // Used a more descriptive name
                    if (rowString !== null) { // rowString can actually be empty if all cells are empty
                        if (seenRowStrings.has(rowString)) {
                            currentSheetIssues.duplicateRows.push({
                                originalRowIndex: index + 2, // Excel row number (1-indexed data + 1 for header)
                                duplicateOf: seenRowStrings.get(rowString) + 2 // Row where first seen
                            });
                        } else {
                            seenRowStrings.set(rowString, index); // Store index of first occurrence
                        }
                    }
                });
                overallStats.duplicateRowCount += currentSheetIssues.duplicateRows.length;


                // --- Custom Validation from Data Dictionary (PRIMARY VALIDATION) ---
                if (parsedDataDictionaryRules && Object.keys(validationRules).length > 0) {
                    sheetHeader.forEach((header, colIndex) => {
                        const columnName = String(header).trim();
                        // Rules for this specific column
                        const columnRules = validationRules[columnName];

                        if (columnRules && columnRules.length > 0) {
                            currentSheetIssues.customValidation[columnName] = [];

                            // Process non-UNIQUE rules first
                            columnRules.filter(r => String(r['Validation Type']).trim().toUpperCase() !== 'UNIQUE').forEach(rule => {
                                const ruleType = String(rule['Validation Type']).trim().toUpperCase();
                                const ruleValue = rule['Validation Value'];
                                const failureMessage = rule['Failure Message'] || `Validation failed for ${columnName} (Rule: ${ruleType})`;

                                sheetData.forEach((row, rowIndex) => {
                                    const cellValue = row[colIndex];
                                    // More robust check for empty/whitespace: explicitly ensure string before trim
                                    const isCellEmptyOrWhitespace = (cellValue === undefined || cellValue === null || (typeof cellValue === 'string' && cellValue.trim() === ''));
                                    let isValid = true;

                                    // Increment processed cells count only if it's not a UNIQUE rule (handled separately)
                                    // and if the cell is NOT empty/whitespace, OR if it's a REQUIRED rule (which checks for emptiness)
                                    if (ruleType !== 'UNIQUE' && (!isCellEmptyOrWhitespace || ruleType === 'REQUIRED')) {
                                        overallStats.totalProcessedCells++;
                                    }

                                    // NEW LOGIC: Skip non-REQUIRED rules for empty/whitespace cells
                                    if (ruleType !== 'REQUIRED' && isCellEmptyOrWhitespace) {
                                        return; // Skip validation for this cell for this rule
                                    }

                                    let issueDetails = {
                                        row: rowIndex + 2, // Excel row number (1-indexed data + 1 for header)
                                        value: cellValue,
                                        message: failureMessage,
                                        ruleType: ruleType
                                    };

                                    switch (ruleType) {
                                        case 'REQUIRED':
                                            isValid = !isCellEmptyOrWhitespace;
                                            break;
                                        case 'ALLOWED_VALUES':
                                            if (ruleValue) {
                                                const allowed = String(ruleValue).split(',').map(s => s.trim().toLowerCase());
                                                isValid = allowed.includes(String(cellValue).trim().toLowerCase());
                                            } else { isValid = false; }
                                            break;
                                        case 'NUMERIC_RANGE':
                                            if (ruleValue) {
                                                const [min, max] = String(ruleValue).split('-').map(Number);
                                                const numericValue = parseFloat(cellValue);
                                                isValid = !isNaN(numericValue) && numericValue >= min && numericValue <= max;
                                            } else { isValid = false; }
                                            break;
                                        case 'REGEX':
                                            if (ruleValue) {
                                                try {
                                                    const regex = new RegExp(ruleValue);
                                                    isValid = regex.test(String(cellValue));
                                                } catch (e) {
                                                    console.warn(`Invalid regex for column ${columnName}: ${ruleValue}. Skipping rule.`);
                                                    isValid = true;
                                                }
                                            } else { isValid = false; }
                                            break;
                                        case 'DATE_PAST':
                                            try {
                                                let processedDate = cellValue;
                                                if (typeof cellValue === 'number' && !isNaN(cellValue)) {
                                                    processedDate = new Date(Math.round((cellValue - 25569) * 86400 * 1000));
                                                } else if (typeof cellValue === 'string') {
                                                    processedDate = new Date(cellValue);
                                                }
                                                isValid = processedDate instanceof Date && !isNaN(processedDate.getTime()) && processedDate < TODAY;
                                            } catch (e) {
                                                isValid = false;
                                            }
                                            break;
                                        default:
                                            console.warn(`Unknown validation type: ${ruleType} for column ${columnName}. Skipping.`);
                                            isValid = true;
                                    }

                                    if (!isValid) {
                                        currentSheetIssues.customValidation[columnName].push(issueDetails);
                                        overallStats.customIssueCount++;
                                    }
                                });
                            });

                            // NEW LOGIC: Dedicated pass for UNIQUE rule after all single-cell rules
                            const uniqueRule = columnRules.find(r => String(r['Validation Type']).trim().toUpperCase() === 'UNIQUE');
                            if (uniqueRule) {
                                // The message for the UNIQUE rule (if defined)
                                const failureMessageUnique = uniqueRule['Failure Message'] || `Value in column '${columnName}' is not unique.`;
                                const seenForUniqueFinal = new Set();

                                sheetData.forEach((row, idx) => { // Iterate sheetData rows
                                    const cellValue = row[colIndex]; // Get the cell value for the current column
                                    const isValEmpty = (cellValue === undefined || cellValue === null || (typeof cellValue === 'string' && String(cellValue).trim() === ''));

                                    if (!isValEmpty) { // Only consider non-empty values for uniqueness
                                        overallStats.totalProcessedCells++; // Count as processed for UNIQUE rule
                                        const lowerCaseVal = String(cellValue).trim().toLowerCase();

                                        if (seenForUniqueFinal.has(lowerCaseVal)) {
                                            const alreadyFlagged = currentSheetIssues.customValidation[columnName].some(issue =>
                                                issue.row === idx + 2 && String(issue.value).trim().toLowerCase() === lowerCaseVal && issue.ruleType === 'UNIQUE'
                                            );
                                            if (!alreadyFlagged) {
                                                currentSheetIssues.customValidation[columnName].push({
                                                    row: idx + 2,
                                                    value: cellValue, // Use original cellValue here
                                                    message: failureMessageUnique, // Use specific message for unique
                                                    ruleType: 'UNIQUE'
                                                });
                                                overallStats.customIssueCount++;
                                            }
                                        } else {
                                            seenForUniqueFinal.add(lowerCaseVal);
                                        }
                                    }
                                });
                            }
                        }
                    });
                }

                analysisResults[sheetName] = currentSheetIssues;
                displaySheetResults(sheetName, currentSheetIssues, sheetHeader);
            });

            updateInitialOverallCountsDisplay();

            document.getElementById('results').style.display = 'block';
            document.getElementById('generateSummaryBtn').style.display = 'inline-block';

        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file: ' + error.message + '. Please ensure it is a valid Excel or CSV file.');
            document.getElementById('results').style.display = 'none';
            document.getElementById('generateSummaryBtn').style.display = 'none';
        } finally {
            hideLoader('loader', ['analyzeFileBtn', 'loadMainFileBtn', 'loadDataDictionaryBtn']); // Using common-utils hideLoader
        }
    };
    reader.readAsArrayBuffer(fileToAnalyze);
}


/**
 * Renders the detailed results for each sheet, focusing on custom validation issues and duplicates.
 */
function displaySheetResults(sheetName, issues, header) {
    const sheetResultsDiv = document.getElementById('sheetResults');
    const sheetResultsContainer = document.createElement('div');
    sheetResultsContainer.classList.add('sheet-summary');
    sheetResultsContainer.innerHTML = `<h3>Sheet: ${sheetName}</h3>`;

    const columnsListUL = document.createElement('ul');
    const hasCustomIssues = Object.keys(issues.customValidation).some(col => issues.customValidation[col].length > 0);
    const hasDuplicates = issues.duplicateRows.length > 0;

    if (hasCustomIssues || hasDuplicates) {
        header.forEach(colName => {
            const customIssues = issues.customValidation[String(colName).trim()] || [];
            const listItem = document.createElement('li');

            let issueDescriptions = [];
            if (customIssues.length > 0) {
                issueDescriptions.push(`${customIssues.length} custom issue(s)`);
            }

            const issueTextHTML = issueDescriptions.length > 0
                ? `<span class="issues">Column "<strong>${colName}</strong>" contains: ${issueDescriptions.join(', ')}.</span>`
                : `<span class="clean">Column "<strong>${colName}</strong>" is clean (custom rules).</span>`;

            const safeColumnName = String(colName).trim().replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const overrideCheckboxId = `override-${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}-${safeColumnName.replace(/[^a-zA-Z0-9]/g, "_")}`;

            listItem.innerHTML = `
                <div class="column-summary">
                    <div class="column-header-controls">
                        <input type="checkbox" id="${overrideCheckboxId}" class="override-checkbox" data-sheet="${sheetName}" data-column="${safeColumnName}">
                        <label for="${overrideCheckboxId}" class="override-checkbox-label">Override Issues</label>
                        <span class="column-issue-text">${issueTextHTML}</span>
                        <button class="toggle-values-btn" data-sheet="${sheetName}" data-column="${safeColumnName}">Show Values</button>
                    </div>
                    <div class="column-counts">Custom: ${customIssues.length}</div>
                </div>
                <div class="column-values-container" style="display:none;"></div>
            `;
            columnsListUL.appendChild(listItem);
        });
    } else {
        const cleanMsg = document.createElement('li');
        cleanMsg.textContent = "No custom validation issues or duplicate rows found for this sheet.";
        columnsListUL.appendChild(cleanMsg);
    }

    sheetResultsContainer.appendChild(columnsListUL);

    sheetResultsDiv.appendChild(sheetResultsContainer);
}

/**
 * Generates and displays a comprehensive summary report.
 * Now accounts for only custom validation issues and duplicates.
 */
function generateSummaryReport(shouldScrollToReport = true) {
    const summaryContainer = document.getElementById('summaryReportContainer');
    summaryContainer.innerHTML = '';
    summaryContainer.style.display = 'block';

    // Recalculate stats based on overrides from the display
    recalculateGlobalOverallStatsFromWorkbookData();

    const excelFileName = document.getElementById('fileName').textContent.replace('File: ', '');

    const totalEffectiveIssues = overallStats.customIssueCount + overallStats.duplicateRowCount;
    const denominator = (overallStats.totalProcessedCells + overallStats.totalProcessedRowsForDuplicates) || 1;
    const issueRate = (totalEffectiveIssues / denominator) * 100;
    const cleanRate = Math.max(0, 100 - issueRate);
    const CLEAN_RATE_PASS_THRESHOLD = 95;
    const passFailStatus = cleanRate >= CLEAN_RATE_PASS_THRESHOLD ? "Pass" : "Fail";
    const passFailClass = passFailStatus === "Pass" ? "pass-status" : "fail-status";

    let reportHTML = `<h1>Data Quality Summary Report</h1><div class="summary-section"><h2>Overall Statistics (Overrides Applied)</h2>`;
    reportHTML += `<p><strong>File:</strong> ${excelFileName}</p>`;
    reportHTML += `<p><strong>Total Cells Processed (for custom rules):</strong> ${overallStats.totalProcessedCells}</p>`;
    reportHTML += `<p><strong>Total Rows Processed (for duplicates):</strong> ${overallStats.totalProcessedRowsForDuplicates}</p>`;
    reportHTML += `<p><strong>Total Custom Validation Issues (effective):</strong> ${overallStats.customIssueCount}</p>`;
    reportHTML += `<p><strong>Total Duplicate Rows Found:</strong> ${overallStats.duplicateRowCount}</p>`;
    reportHTML += `<p><strong>Total Effective Issues (Custom + Duplicates):</strong> ${totalEffectiveIssues}</p>`;
    reportHTML += `<p><strong>Issue Rate (approximate):</strong> ${issueRate.toFixed(2)}%</p>`;
    reportHTML += `<p><strong>Clean Rate (approximate):</strong> ${cleanRate.toFixed(2)}%</p>`;
    reportHTML += `<p><strong>Status: <span class="${passFailClass}">${passFailStatus}</span></strong> (Threshold: ${CLEAN_RATE_PASS_THRESHOLD}% clean)</p></div>`;

    // Detailed Custom Issues by Column
    reportHTML += `<div class="summary-section"><h2>Detailed Custom Issues by Column</h2><table><thead><tr><th>Sheet</th><th>Column</th><th>Rule Type</th><th>Failure Message</th><th>Value</th><th>Row #</th><th>Overridden</th></tr></thead><tbody>`;
    let customDetailsAdded = false;
    for (const sheetName in analysisResults) {
        const sheetIssues = analysisResults[sheetName];
        const overrideCheckboxes = document.querySelectorAll(`.override-checkbox[data-sheet="${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}"]`);
        const overriddenColsForSheet = {};
        overrideCheckboxes.forEach(cb => {
            if(cb.checked) overriddenColsForSheet[cb.dataset.column] = true;
        });

        for (const columnName in sheetIssues.customValidation) {
            const isColumnOverridden = overriddenColsForSheet[columnName] === true;
            if (isColumnOverridden) {
                customDetailsAdded = true;
                reportHTML += `<tr><td>${sheetName}</td><td>${columnName}</td><td colspan="4" style="text-align: center;">ALL ISSUES OVERRIDDEN FOR THIS COLUMN</td><td>Yes</td></tr>`;
            } else {
                sheetIssues.customValidation[columnName].forEach(issue => {
                    customDetailsAdded = true;
                    reportHTML += `<tr><td>${sheetName}</td><td>${columnName}</td><td>${issue.ruleType}</td><td>${issue.message}</td><td>${String(issue.value) === '' ? '[Blank]' : String(issue.value)}</td><td>${issue.row}</td><td>No</td></tr>`;
                });
            }
        }
    }
    if (!customDetailsAdded) reportHTML += `<tr><td colspan="7">No custom validation issues found.</td></tr>`;
    reportHTML += `</tbody></table></div>`;

    // Duplicate Row Details
    reportHTML += `<div class="summary-section"><h3>Duplicate Row Details</h3><table><thead><tr><th>Sheet</th><th>Duplicate Row #</th><th>First Seen At Row #</th><th>Sample Data (First 3 Cells)</th></tr></thead><tbody>`;
    let duplicatesListed = false;
    for (const sheetName in analysisResults) {
        const { duplicateRows } = analysisResults[sheetName];
        if (duplicateRows && duplicateRows.length > 0) {
            duplicatesListed = true;
            duplicateRows.forEach(dupeRow => {
                const rowData = parsedExcelData.Sheets[sheetName] ? XLSX.utils.sheet_to_json(parsedExcelData.Sheets[sheetName], {header:1, defval:null})[dupeRow.originalRowIndex -1] : [];
                if (rowData) {
                    const sample = rowData.slice(0, 3).map(d => d ?? "").join(', ');
                    reportHTML += `<tr><td>${sheetName}</td><td>${dupeRow.originalRowIndex}</td><td>${dupeRow.duplicateOf}</td><td>${sample}...</td></tr>`;
                }
            });
        }
    }
    if (!duplicatesListed) reportHTML += `<tr><td colspan="4">No duplicate rows found.</td></tr>`;
    reportHTML += `</tbody></table></div>`;

    reportHTML += `<button id="printSummaryBtn" onclick="window.print()" class="action-button">Print Report</button>`;
    reportHTML += `<button id="exportExcelBtn" onclick="exportExcelWithSummary()" class="action-button">Export Excel w/ Summary</button`;
    summaryContainer.innerHTML = reportHTML;
    summaryContainer.style.display = 'block';
    if (shouldScrollToReport) summaryContainer.scrollIntoView({ behavior: 'smooth' });
}


/**
 * Recalculates overall stats based on current analysisResults and override checkboxes.
 * Now focuses only on custom issues and duplicates.
 */
function recalculateGlobalOverallStatsFromWorkbookData() {
    let newCustom = 0;
    let newDuplicates = 0;

    for (const sheetName in analysisResults) {
        const sheetIssues = analysisResults[sheetName];
        const overrideCheckboxes = document.querySelectorAll(`.override-checkbox[data-sheet="${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}"]`);
        const overriddenColsForSheet = {};
        overrideCheckboxes.forEach(cb => {
            if (cb.checked) {
                overriddenColsForSheet[cb.dataset.column] = true;
            }
        });

        // Count custom issues only if column is NOT overridden
        for (const colName in sheetIssues.customValidation) {
            if (!overriddenColsForSheet[colName]) {
                newCustom += sheetIssues.customValidation[colName].length;
            }
        }

        // Duplicates are counted directly from analysisResults
        newDuplicates += sheetIssues.duplicateRows.length;
    }

    overallStats.customIssueCount = newCustom;
    overallStats.duplicateRowCount = newDuplicates;
}

/**
 * Exports the original Excel data along with a new sheet containing the validation summary report
 * to a new Excel file downloadable by the user.
 */
function exportExcelWithSummary() {
    console.log("exportExcelWithSummary: Function started.");
    if (!parsedExcelData) {
        alert("Please analyze a file first.");
        console.warn("exportExcelWithSummary: parsedExcelData is null. Cannot export.");
        return;
    }

    const wb = XLSX.utils.book_new();
    console.log("exportExcelWithSummary: Workbook created.");

    // Add original data sheets
    parsedExcelData.SheetNames.forEach(sheetName => {
        console.log(`exportExcelWithSummary: Appending original sheet: ${sheetName}`);
        // Use XLSX.utils.sheet_to_json to get AoA, then XLSX.utils.aoa_to_sheet to convert back
        // This ensures consistency in structure, crucial if the original worksheet has complex cell types.
        const aoaFromSheet = XLSX.utils.sheet_to_json(parsedExcelData.Sheets[sheetName], { header: 1, defval: null });
        const ws = XLSX.utils.aoa_to_sheet(aoaFromSheet);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    console.log("exportExcelWithSummary: Original sheets appended.");

    // Generate Summary Report sheet
    const summaryAoA = [];
    recalculateGlobalOverallStatsFromWorkbookData();
    console.log("exportExcelWithSummary: Overall Stats for Summary:", overallStats);

    const { customIssueCount, duplicateRowCount, totalProcessedCells, totalProcessedRowsForDuplicates } = overallStats;
    const totalEffectiveIssues = customIssueCount + duplicateRowCount;
    const denominator = (totalProcessedCells + totalProcessedRowsForDuplicates) || 1;
    const issueRate = (totalEffectiveIssues / denominator) * 100;
    const cleanRate = Math.max(0, 100 - issueRate);
    const CLEAN_RATE_PASS_THRESHOLD = 95;
    const status = cleanRate >= CLEAN_RATE_PASS_THRESHOLD ? "Pass" : "Fail";

    summaryAoA.push(["Data Quality Summary Report"]);
    summaryAoA.push([]);
    summaryAoA.push(["Overall Statistics"]);
    summaryAoA.push(["File:", document.getElementById('fileName').textContent.replace('File: ', '')]);
    summaryAoA.push(["Total Cells Processed (for custom rules):", totalProcessedCells]);
    summaryAoA.push(["Total Rows Processed (for duplicates):", totalProcessedRowsForDuplicates]);
    summaryAoA.push(["Total Custom Validation Issues (effective):", customIssueCount]);
    summaryAoA.push(["Total Duplicate Rows Found:", duplicateRowCount]);
    summaryAoA.push(["Total Effective Issues (Custom + Duplicates):", totalEffectiveIssues]);
    summaryAoA.push(["Issue Rate (approximate):", `${issueRate.toFixed(2)}%`]);
    summaryAoA.push(["Clean Rate (approximate):", `${cleanRate.toFixed(2)}%`]);
    summaryAoA.push(["Status:", `${status} (Threshold: ${CLEAN_RATE_PASS_THRESHOLD}% clean)`]);
    summaryAoA.push([]);

    // Detailed Custom Issues by Column for Export
    summaryAoA.push(["Detailed Custom Issues by Column"]);
    summaryAoA.push(["Sheet", "Column", "Rule Type", "Failure Message", "Value", "Row #", "Overridden"]);

    let customDetailsAdded = false;
    for (const sheetName in analysisResults) {
        const sheetIssues = analysisResults[sheetName];
        const overrideCheckboxes = document.querySelectorAll(`.override-checkbox[data-sheet="${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}"]`);
        const overriddenColsForSheet = {};
        overrideCheckboxes.forEach(cb => {
            if(cb.checked) overriddenColsForSheet[cb.dataset.column] = true;
        });

        for (const columnName in sheetIssues.customValidation) {
            const isColumnOverridden = overriddenColsForSheet[columnName] === true;
            if (isColumnOverridden) {
                customDetailsAdded = true;
                summaryAoA.push([sheetName, columnName, "N/A", "ALL ISSUES OVERRIDDEN FOR THIS COLUMN", "N/A", "N/A", "Yes"]);
            } else {
                sheetIssues.customValidation[columnName].forEach(issue => {
                    customDetailsAdded = true;
                    summaryAoA.push([sheetName, columnName, issue.ruleType, issue.message, String(issue.value) === '' ? '[Blank]' : String(issue.value), issue.row, "No"]);
                });
            }
        }
    }
    if (!customDetailsAdded) summaryAoA.push(["No custom validation issues found or overridden to export."]);
    summaryAoA.push([]);

    // Duplicate Row Details for Export
    summaryAoA.push(["Duplicate Row Details"]);
    summaryAoA.push(["Sheet", "Duplicate Row #", "First Seen At Row #", "Sample Data (First 3 Cells)"]);

    let duplicatesExported = false;
    for (const sheetName in analysisResults) {
        const { duplicateRows } = analysisResults[sheetName];
        if (duplicateRows && duplicateRows.length > 0) {
            duplicatesExported = true;
            duplicateRows.forEach(dupeRow => {
                const rowData = parsedExcelData.Sheets[sheetName] ? XLSX.utils.sheet_to_json(parsedExcelData.Sheets[sheetName], {header:1, defval:null})[dupeRow.originalRowIndex -1] : [];
                if (rowData) {
                    const sample = rowData.slice(0, 3).map(d => d ?? "").join(', ');
                    summaryAoA.push([sheetName, dupeRow.originalRowIndex, dupeRow.duplicateOf, `${sample}...`]);
                }
            });
        }
    }
    if (!duplicatesExported) summaryAoA.push(["No duplicate rows found to export."]);

    const summaryWS = XLSX.utils.aoa_to_sheet(summaryAoA);
    XLSX.utils.book_append_sheet(wb, summaryWS, "Validation Summary");

    // Define the output filename based on the selectedMainFileName
    const baseFileName = selectedMainFileName ? selectedMainFileName.replace(/\.(xlsx|xls|csv)$/i, '') : "Validation_Report";
    const outputFileName = `${baseFileName}_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
    console.log("exportExcelWithSummary: Attempting to write file:", outputFileName);

    // Attempt to write the file
    try {
        XLSX.writeFile(wb, outputFileName);
        console.log("exportExcelWithSummary: File write command executed successfully. Check downloads.");
    } catch (writeError) {
        console.error("exportExcelWithSummary: Error writing file:", writeError);
        alert(`Error exporting report: ${writeError.message}. Check browser console.`);
    }
}

// --- Initialization Function ---
async function initValidationEngine() {
    // Check for JWT on page load to ensure user is authenticated
    // Note: verifyAndSetupUser from public/js/auth.js will handle redirection if not authenticated
    // Assuming verifyAndSetupUser is still a global function exposed by auth.js
    if (typeof verifyAndSetupUser === 'function') {
        const userData = await verifyAndSetupUser();
        if (userData) {
            populateSelects(); // Populate file and dictionary dropdowns
        }
    } else {
        console.error("verifyAndSetupUser function not found. Ensure public/js/auth.js is loaded correctly and exposes it globally.");
        // Fallback for development if auth.js isn't fully set up, or redirect
        window.location.href = '/';
    }


    // Set dynamic date display
    const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    const dateElement = document.getElementById('dynamicTodayDate');
    if (dateElement) {
        dateElement.textContent = TODAY.toLocaleDateString('en-US', options);
    }

    // --- Event Listeners for Validation Engine Logic ---

    // Main file selection (from server or local)
    document.getElementById('loadMainFileBtn').addEventListener('click', loadMainFile);
    document.getElementById('excelFile').addEventListener('change', () => {
        document.getElementById('mainFileSelect').value = '';
        selectedMainFileBlob = null;
        selectedMainFileName = null;
        displayMessage('mainFileStatus', '', 'info');
    });
    document.getElementById('mainFileSelect').addEventListener('change', () => {
        document.getElementById('excelFile').value = '';
        displayMessage('mainFileStatus', '', 'info');
    });

    // Data dictionary selection
    document.getElementById('loadDataDictionaryBtn').addEventListener('click', loadDataDictionary);

    // Analyze button (uses onclick in HTML, so no need to duplicate here)

    // Delegate event for override checkboxes and show values buttons
    document.getElementById('sheetResults').addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('override-checkbox')) {
            const { sheet, column } = target.dataset;

            // Visually toggle 'column-overridden' class for immediate feedback
            const columnSummaryElement = target.closest('.column-summary');
            if (columnSummaryElement) {
                columnSummaryElement.classList.toggle('column-overridden', target.checked);
            } else {
                console.warn("Could not find parent .column-summary for override checkbox.");
            }

            // Recalculate summary if it's already visible
            if (document.getElementById('summaryReportContainer').style.display !== 'none') {
                generateSummaryReport(false); // Update summary without scrolling
            } else {
                // Update overall counts for the initial display if needed (e.g. for duplicates)
                recalculateGlobalOverallStatsFromWorkbookData();
                updateInitialOverallCountsDisplay();
            }
        } else if (target.classList.contains('toggle-values-btn')) {
            const { sheet, column } = target.dataset;
            const valuesContainer = target.closest('li')?.querySelector('.column-values-container');
            if (!valuesContainer) {
                console.error("Could not find valuesContainer for toggle button.");
                return;
            }

            // Check if there are custom issues for this column to display
            if (!analysisResults[sheet]?.customValidation?.[column] || analysisResults[sheet].customValidation[column].length === 0) {
                valuesContainer.innerHTML = '<p style="font-style: italic; color: #6c757d;">No custom issues for this column.</p>';
                valuesContainer.style.display = 'block';
                target.textContent = 'Hide Values';
                return;
            }

            if (valuesContainer.style.display === 'none') {
                valuesContainer.innerHTML = '';
                const ul = document.createElement('ul');
                const customIssuesForColumn = analysisResults[sheet].customValidation[column];

                // Sort issues by row number for better readability
                customIssuesForColumn.sort((a,b) => a.row - b.row).forEach(issue => {
                    const li = document.createElement('li');
                    let displayValue = `Row ${issue.row}: Rule: ${issue.ruleType} - Value: "${String(issue.value)}" - Message: ${issue.message}`;
                    if (String(issue.value).trim() === '') {
                        displayValue = `Row ${issue.row}: Rule: ${issue.ruleType} - Value: [BLANK] - Message: ${issue.message}`;
                    } else if (issue.value === null) {
                        displayValue = `Row ${issue.row}: Rule: ${issue.ruleType} - Value: [NULL] - Message: ${issue.message}`;
                    }
                    li.classList.add('value-generic-issue');
                    li.textContent = displayValue;
                    ul.appendChild(li);
                });

                valuesContainer.appendChild(ul);
                valuesContainer.style.display = 'block';
                target.textContent = 'Hide Values';
            } else {
                valuesContainer.style.display = 'none';
                valuesContainer.innerHTML = '';
                target.textContent = 'Show Values';
            }
        }
    });

    // Delegate event for editable stats in summary report (THIS FUNCTIONALITY WILL BE LIMITED)
    document.getElementById('summaryReportContainer')?.addEventListener('blur', function(event) {
        if (event.target.classList.contains('editable-stat')) {
            const td = event.target;
            const { sheet, column, type } = td.dataset;

            // ALERT: Directly editing issue counts is not ideal.
            // The numbers are derived from the analysis results and override checkboxes.
            // This section of code is left as is, but it will only provide a warning
            // and revert the text, as editing these directly isn't a good UX for custom rules.
            alert('Editing issue counts directly is not fully supported for custom rules. Please use the "Override Issues" checkbox instead.');

            // Revert text if they changed it
            if (analysisResults[sheet]?.customValidation?.[column]) {
                const originalCount = analysisResults[sheet].customValidation[column].length;
                td.textContent = originalCount;
            } else {
                td.textContent = '0';
            }
        }
    }, true);
}

// Expose functions to the global scope if they are called directly from HTML's onclick/onload
// For example, analyzeFile is called via onclick="analyzeFile()"
window.analyzeFile = analyzeFile;
window.generateSummaryReport = generateSummaryReport;
window.exportExcelWithSummary = exportExcelWithSummary;
window.initValidationEngine = initValidationEngine; // Expose the initialization function
