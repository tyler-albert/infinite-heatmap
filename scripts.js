// The width in pixels of each cell
var CELL_WIDTH = 60;
// The height in pixels of each cell
var CELL_HEIGHT = 60;

// The number of divs surrounding the "core" window
var BUFFER_SIZE = 20;
// The threshold for scrolling after which recycling should occur
var RECYCLE_THRESHOLD = 10;

// This is the total number of divs rendered in the dom
// TOTAL_LOADED_ROWS is computed as: TOTAL_LOADED_ROWS = (2 * BUFFER_SIZE) + SLIDING_WINDOW_ROWS
// TOTAL_LOADED_COLUMNS is computed as: TOTAL_LOADED_COLUMNS = (2 * BUFFER_SIZE) + SLIDING_WINDOW_COLUMNS
var TOTAL_LOADED_ROWS = 0;
var TOTAL_LOADED_COLUMNS = 0;

// Table and tableContent divs
var tableDiv;
var tableContentDiv;
var rowHeaderScrollContainer;
var rowHeaderContainerDiv;
var columnHeaderScrollContainer;
var columnHeaderContainerDiv;

// This matrix will be populated as the user scrolls around, so that
// returning to previous slices will be in-memory
var loadedDataMatrix;
var loadedRowHeaderList;
var loadedColumnHeaderList;
// This is the matrix of every div that is absolutely positioned
// Which will be repositioned as transitions happen
var cellMatrix = [];
var rowHeaderCellList;
var columnHeaderCellList;

// Much like coordinates in the dom, these are the coordinates of the
// top left cell of the entire matrix that is loaded,
// NOT what the user is currently looking at
// These will only change when recycling occurs or if the
// view is resized in such a way that.... TODO
var currentRowIndex;
var currentColumnIndex;

var totalRows;
var totalColumns;

// Timeout for delaying fetching data
var recyclerTimeout = null;
var scrollbarWidth = 0;

document.addEventListener("DOMContentLoaded", function () {
    scrollbarWidth = getScrollbarWidth();

    tableDiv = document.querySelector("#table-body");
    tableContentDiv = document.querySelector("#table-content");
    rowHeaderScrollContainer = document.querySelector("#row-header-scroll-container");
    rowHeaderContainerDiv = document.querySelector("#row-header-container");
    rowHeaderContainerDiv.style.marginBottom = scrollbarWidth + "px";

    columnHeaderScrollContainer = document.querySelector("#column-header-scroll-container");
    columnHeaderContainerDiv = document.querySelector("#column-header-container");
    columnHeaderContainerDiv.style.marginRight = scrollbarWidth + "px";

    initialize(1000, 1000);
    resizeTable();
});

// Need total rows and columns to size scroll divs
function initialize(totalRowsInit, totalColumnsInit) {
    totalRows = totalRowsInit;
    totalColumns = totalColumnsInit;

    loadedDataMatrix = [];
    for(var i = 0; i < totalRows; i++) {
        var newRow = [];
        for(var j = 0; j < totalColumns; j++) {
            // placeholder value
            newRow.push(null);
        }
        loadedDataMatrix.push(newRow);
    }

    loadedRowHeaderList = [];
    for(var i = 0; i < totalRows; i++) {
        loadedRowHeaderList.push(null);
    }

    loadedColumnHeaderList = [];
    for(var j = 0; j < totalRows; j++) {
        loadedColumnHeaderList.push(null);
    }

    rowHeaderCellList = [];
    columnHeaderCellList = [];

    // reset scroll position
    tableDiv.scrollLeft = 0;
    tableDiv.scrollTop = 0;

    tableContentDiv.style.width = (totalRows * CELL_WIDTH) + "px";
    columnHeaderContainerDiv.style.width = ((totalRows * CELL_WIDTH) + scrollbarWidth ) + "px";

    tableContentDiv.style.height = (totalColumns * CELL_HEIGHT) + "px";
    rowHeaderContainerDiv.style.height = ((totalColumns * CELL_HEIGHT) + scrollbarWidth) + "px";

    // Start user in the top left corner
    currentRowIndex = 0;
    currentColumnIndex = 0;
}

function resizeTable() {
    let tableWidth = tableDiv.getBoundingClientRect().width;
    let tableHeight = tableDiv.getBoundingClientRect().height;

    let SLIDING_WINDOW_ROWS = Math.floor(tableWidth / CELL_WIDTH);
    let SLIDING_WINDOW_COLUMNS = Math.floor(tableHeight / CELL_HEIGHT);

    var newTotalLoadedRows = (2 * BUFFER_SIZE) + SLIDING_WINDOW_ROWS;
    var newTotalLoadedColumns = (2 * BUFFER_SIZE) + SLIDING_WINDOW_COLUMNS;

    // Get all data into memory
    fetchData(currentRowIndex, newTotalLoadedRows, currentColumnIndex, newTotalLoadedColumns);

    if(newTotalLoadedRows < TOTAL_LOADED_ROWS) {
        // The user reduced the size of the window, remove rows
        var removedRowList = cellMatrix.splice(newTotalLoadedRows);
        for(var row of removedRowList) {
            for(var cell of row) {
                tableContentDiv.removeChild(cell);
            }
        }

        var removedRowHeaderList = rowHeaderCellList.splice(newTotalLoadedRows);
        for(var rowHeader of removedRowHeaderList) {
            rowHeaderContainerDiv.removeChild(rowHeader);
        }
    } else if(newTotalLoadedRows > TOTAL_LOADED_ROWS) {
        // The user increased the size of the window, add rows
        for(var i = TOTAL_LOADED_ROWS; i < newTotalLoadedRows; i++) {
            var newRow = [];
            // Note that we iterate up to the OLD column value here
            // Any added columns will be added in the next block
            for(var j = 0; j < TOTAL_LOADED_COLUMNS; j++) {
                var newCell = createCell(i, j);
                newRow.push(newCell);
                tableContentDiv.appendChild(newCell);
            }

            cellMatrix.push(newRow);

            var newRowHeader = createRowHeaderCell(i);
            rowHeaderCellList.push(newRowHeader);
            rowHeaderContainerDiv.appendChild(newRowHeader);
        }
    }

    if(newTotalLoadedColumns < TOTAL_LOADED_COLUMNS) {
        // The user reduced the size of the window, remove columns
        for(var row of cellMatrix) {
            var removedColumnList = row.splice(newTotalLoadedColumns);
            for(var column of removedColumnList) {
                tableContentDiv.removeChild(column);
            }
        }

        var removedColumnHeaderList = columnHeaderCellList.splice(newTotalLoadedColumns);
        for(var columnHeader of removedColumnHeaderList) {
            columnHeaderCellList.removeChild(columnHeader);
        }
    } else if(newTotalLoadedColumns > TOTAL_LOADED_COLUMNS) {
        // The user increased the size of the window, add column
        // INCLUDING adding columns to any newly added rows
        for(var i = 0; i < newTotalLoadedRows; i++) {
            var row = cellMatrix[i];
            for(var j = TOTAL_LOADED_COLUMNS; j < newTotalLoadedColumns; j++) {
                var newCell = createCell(i, j);
                row.push(newCell);
                tableContentDiv.appendChild(newCell);
            }
        }

        for(var j = TOTAL_LOADED_COLUMNS; j < newTotalLoadedColumns; j++) {
            var newColumnHeader = createColumnHeaderCell(j);
            columnHeaderCellList.push(newColumnHeader);
            columnHeaderContainerDiv.appendChild(newColumnHeader);
        }
    }

    TOTAL_LOADED_ROWS = newTotalLoadedRows;
    TOTAL_LOADED_COLUMNS = newTotalLoadedColumns;
}

// Stub for server call
// Just replace every entry, don't think about paging yet
function fetchData(rowFrom, rowSize, columnFrom, columnSize) {
    var maxRows = rowFrom + rowSize;
    var maxColumns = columnFrom + columnSize;
    for(var i = rowFrom; i < maxRows; i++) {
        for(var j = columnFrom; j < maxColumns; j++) {
            //loadedDataMatrix[i][j] = i + "," + j;
            loadedDataMatrix[i][j] = (i * j) % 100000;
        }
    }

    for(var i = rowFrom; i < maxRows; i++) {
        loadedRowHeaderList[i] = i;
    }

    for(var j = columnFrom; j < maxColumns; j++) {
        loadedColumnHeaderList[j] = j;
    }
}

function createRowHeaderCell(row) {
    var newCell = document.createElement("div");
    newCell.classList.add("row-header-cell");
    newCell.style.transform = getTransform(row, 0);
    newCell.textContent = loadedRowHeaderList[row];

    return newCell;
}

function createColumnHeaderCell(column) {
    var newCell = document.createElement("div");
    newCell.classList.add("column-header-cell");
    newCell.style.transform = getTransform(0, column);
    newCell.textContent = loadedColumnHeaderList[column];

    return newCell;
}

function createCell(row, column) {
    var newCell = document.createElement("div");
    newCell.classList.add("body-cell");
    newCell.style.transform = getTransform(row, column);
    newCell.textContent = loadedDataMatrix[row][column];

    return newCell;
}

function getTransform(row, column) {
    // Note that the order of row and column is switched here
    // Everywhere else, we use i,j syntax, where going down the matrix means changing i
    // For pixels though, we need x,y, so we need to change y to move down
    return "translate(" + (CELL_WIDTH * column) + "px, " + (CELL_HEIGHT * row) + "px)";
}

var recentlyRecycled = false;
function scrollHandler() {
    let doRecycle = false;

    let scrollX = tableDiv.scrollLeft;
    columnHeaderScrollContainer.scrollLeft = scrollX;

    let destinationColumnIndex = Math.floor(scrollX / CELL_WIDTH) - RECYCLE_THRESHOLD;
    // We load TOTAL_LOAD_COLUMNS worth of data later
    if(destinationColumnIndex > totalColumns - TOTAL_LOADED_COLUMNS) {
        destinationColumnIndex = totalColumns - TOTAL_LOADED_COLUMNS;
    } else if(destinationColumnIndex < 0) {
        // Left bounds check taking into account the RECYCLE_THRESHOLD
        destinationColumnIndex = 0;
    }

    if(destinationColumnIndex != currentColumnIndex) {
        var recycleLeft = 
            // we've gone beyond the recycle threshold
            // if the current index is 37, and we scroll to the left to 32, the window is 
            // still loaded until 32, but we will recycle the right-most columns to make the 
            // scrolling feel clean
            currentColumnIndex - destinationColumnIndex >= 0;
            // Note that scrolling left and scrolling up doesnt need to check
            // whether the current index is in the buffer range.
            // && currentColumnIndex >= RECYCLE_THRESHOLD;

        var recycleRight = 
            // Right bounds check
            destinationColumnIndex - currentColumnIndex >= 0 &&
            // Are we inside the right buffer
            totalColumns - currentRowIndex >= RECYCLE_THRESHOLD;


        doRecycle ||= recycleLeft || recycleRight;
    }

    let scrollY = tableDiv.scrollTop;
    rowHeaderScrollContainer.scrollTop = scrollY;

    let destinationRowIndex = Math.floor(scrollY / CELL_HEIGHT) - RECYCLE_THRESHOLD;
    // If destination is inside the bottom page, just load the bottom page
    if(destinationRowIndex > totalRows - TOTAL_LOADED_ROWS) {
        destinationRowIndex = totalRows - TOTAL_LOADED_ROWS;
    } else if(destinationRowIndex < 0) {
        destinationRowIndex = 0;
    }

    if(destinationRowIndex != currentRowIndex) {
        var recycleTop = 
            // Top bounds check: 15 - 7 = 8 >= 5, meaning the user scrolled to index 7
            currentRowIndex - destinationRowIndex >= 0;
            // Scrolling up and left doesnt need this bounds check (?)
            // && currentRowIndex >= RECYCLE_THRESHOLD;
        
        var recycleBottom = 
            // Bottom bounds check
            destinationRowIndex - currentRowIndex >= 0 &&
            totalRows - currentRowIndex >= RECYCLE_THRESHOLD;

        // Do an or-equals to preserve the previous recycle bounds check
        doRecycle ||= recycleTop || recycleBottom;
    }

    if(doRecycle === true) {
        // This if check is so that recycling will happen if the user scrolls
        // continuously
        if(!recentlyRecycled) {
            recentlyRecycled = true;
            
            activateRecycle(destinationRowIndex, destinationColumnIndex);
            testTimeout = setTimeout(function() {
                recentlyRecycled = false;
            }, 100);
        }

        // This timeout is to make sure a recycle check will happen if the user stops scrolling
        // during the "recentlyRecycled" window 
        clearTimeout(recyclerTimeout);
        recyclerTimeout = setTimeout(function() {
            activateRecycle(destinationRowIndex, destinationColumnIndex);
            recentlyRecycled = true;

            testTimeout = setTimeout(function() {
                recentlyRecycled = false;
            }, 100);
        }, 50);
    }
}

function activateRecycle(destinationRowIndex, destinationColumnIndex) {
    if(destinationRowIndex == currentRowIndex && destinationColumnIndex == currentColumnIndex) {
        // Shouldn't reach this, but check anyway
        return;
    }

    fetchData(destinationRowIndex, TOTAL_LOADED_ROWS, destinationColumnIndex, TOTAL_LOADED_COLUMNS);

    // Vertical computations
    rowRecycle(destinationRowIndex);
    currentRowIndex = destinationRowIndex;

    columnRecycle(destinationColumnIndex);
    currentColumnIndex = destinationColumnIndex;
}

function rowRecycle(destinationRowIndex) {
    // Horizontal computations
    if(destinationRowIndex > currentRowIndex) {
        // Scrolled down
        var removedRows = destinationRowIndex - currentRowIndex;
        if(removedRows > TOTAL_LOADED_ROWS) {
            // If the user scrolled beyond any loaded cells, simply remove every cell
            // and put them down wherever the scroll landed
            removedRows = TOTAL_LOADED_ROWS;
        }

        var alreadyLoadedOffset = 
            // Logical index of rows
            destinationRowIndex +
            // This computes the number of rows that aren't 
            // being recycled. Therefore, this is the index
            // of the first new row (new row meaning a row that was just recycled)
            TOTAL_LOADED_ROWS - removedRows;
        // Remove cells that are being moved
        // Remove cells from the top of the matrix
        var recycledDivs = cellMatrix.splice(0, removedRows);
        var recycledHeaderDivs = rowHeaderCellList.splice(0, removedRows);
        for(var i in recycledDivs) {
            // Compute rows
            var row = recycledDivs[i];
            // Compute the cell rows forward, because we push
            var cellRow = 
                // Start of rows to recycle
                + alreadyLoadedOffset
                // Index of this recycled row
                + Number(i);

            // Push each row to the bottom of the matrix
            cellMatrix.push(row);
            for(var j in row) {
                var cell = row[j];
                
                var cellColumn = currentColumnIndex + Number(j);
                cell.style.transform = getTransform(cellRow, cellColumn);
                cell.textContent = loadedDataMatrix[cellRow][cellColumn];
            }

            // Compute headers
            var headerDiv = recycledHeaderDivs[i];
            headerDiv.style.transform = getTransform(cellRow, 0);
            headerDiv.textContent = loadedRowHeaderList[cellRow];
            rowHeaderCellList.push(headerDiv);
        }
    } else if(destinationRowIndex < currentRowIndex) {
        // Scrolled up
        var removedRows = currentRowIndex - destinationRowIndex;
        if(removedRows > cellMatrix.length) {
            removedRows = cellMatrix.length;
        }
        
        var alreadyLoadedOffset = 
            // Logical index of rows
            destinationRowIndex 
            // This is the last new row (new row meaning a row that was just recycled)
            // Convserely, adding 1 would be the previous start of the matrix
            + removedRows - 1;
        // Remove cells that are being moved
        // Remove cells from the bottom of the matrix
        var recycledDivs = cellMatrix.splice(TOTAL_LOADED_ROWS - removedRows);
        var recycledHeaderDivs = rowHeaderCellList.splice(TOTAL_LOADED_ROWS - removedRows);

        for(var i in recycledDivs) {
            // Compute rows
            var row = recycledDivs[i];
            // Compute the cell rows backwards, because we unshifted
            var cellRow = alreadyLoadedOffset - Number(i);
            // Push each row to the top of the matrix
            cellMatrix.unshift(row);
            for(var j in row) {
                var cell = row[j];

                var cellColumn = currentColumnIndex + Number(j);
                cell.style.transform = getTransform(cellRow, cellColumn);
                cell.textContent = loadedDataMatrix[cellRow][cellColumn];
            }

            // Compute headers
            var headerDiv = recycledHeaderDivs[i];
            headerDiv.style.transform = getTransform(cellRow, 0);
            headerDiv.textContent = loadedRowHeaderList[cellRow];
            rowHeaderCellList.unshift(headerDiv);
        }
    }
}

function columnRecycle(destinationColumnIndex) {
    // Vertical computations
    if(destinationColumnIndex > currentColumnIndex) {
        var removedColumns = destinationColumnIndex - currentColumnIndex;
        if(removedColumns > TOTAL_LOADED_COLUMNS) {
            removedColumns = TOTAL_LOADED_COLUMNS;
        }

        var alreadyLoadedOffset =
            destinationColumnIndex +
            TOTAL_LOADED_COLUMNS - removedColumns;
        
        for(var i in cellMatrix) {
            var row = cellMatrix[i];
            var cellRow = currentRowIndex + Number(i);

            var recycledDivs = row.splice(0, removedColumns);

            for(var j in recycledDivs) {
                var cell = recycledDivs[j];

                var cellColumn = alreadyLoadedOffset + Number(j);
                cell.style.transform = getTransform(cellRow, cellColumn);
                cell.textContent = loadedDataMatrix[cellRow][cellColumn];

                row.push(cell);
            }
        }

        // Have to do headers seperately, because recycling columns requires
        // going through each row
        var recycledHeaderDivs = columnHeaderCellList.splice(0, removedColumns);
        for(var j in recycledHeaderDivs) {
            var headerDiv = recycledHeaderDivs[j];
            var cellColumn = alreadyLoadedOffset + Number(j);
            headerDiv.style.transform = getTransform(0, cellColumn);
            headerDiv.textContent = loadedColumnHeaderList[cellColumn];
            columnHeaderCellList.push(headerDiv);
        }
    } else if(destinationColumnIndex < currentColumnIndex) {
        var removedColumns = currentColumnIndex - destinationColumnIndex;
        if(removedColumns > TOTAL_LOADED_COLUMNS) {
            removedColumns = TOTAL_LOADED_COLUMNS;
        }

        var alreadyLoadedOffset =
            destinationColumnIndex
            + removedColumns - 1;
        
        for(var i in cellMatrix) {
            var row = cellMatrix[i];
            var cellRow = currentRowIndex + Number(i);

            var recycledDivs = row.splice(TOTAL_LOADED_COLUMNS - removedColumns);
            for(var j in recycledDivs) {
                var cell = recycledDivs[j];

                var cellColumn = alreadyLoadedOffset - Number(j);
                cell.style.transform = getTransform(cellRow, cellColumn);
                cell.textContent = loadedDataMatrix[cellRow][cellColumn];

                row.unshift(cell);
            }
        }

        // Have to do headers seperately, because recycling columns requires
        // going through each row
        var recycledHeaderDivs = columnHeaderCellList.splice(TOTAL_LOADED_COLUMNS - removedColumns);
        for(var j in recycledHeaderDivs) {
            var headerDiv = recycledHeaderDivs[j];
            var cellColumn = alreadyLoadedOffset - Number(j);
            headerDiv.style.transform = getTransform(0, cellColumn);
            headerDiv.textContent = loadedColumnHeaderList[cellColumn];
            columnHeaderCellList.unshift(headerDiv);
        }
    }
}

function getScrollbarWidth() {
    // Creating invisible container
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll'; // forcing scrollbar to appear
    outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
    document.body.appendChild(outer);
  
    // Creating inner element and placing it in the container
    const inner = document.createElement('div');
    outer.appendChild(inner);
  
    // Calculating difference between container's full width and the child width
    const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);
  
    // Removing temporary elements from the DOM
    outer.parentNode.removeChild(outer);
  
    return scrollbarWidth;
  }
