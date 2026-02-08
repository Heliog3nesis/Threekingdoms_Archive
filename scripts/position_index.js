function categorizeByDescriptors(allJsons) {
  const byPin = {};
  const byShi = {};
  
  const pinRegex = /([一二三四五六七八九]{1}品)/g;
  const shiRegex = /([中比]?[一二三四五六七八九十百千萬]{1,4}石)/g;
  
  allJsons.forEach((jsonFile) => {
    for (const sheetName in jsonFile) {
      const rows = jsonFile[sheetName];
      
      if (!Array.isArray(rows)) continue;
      
      // Build cell map to handle rowspan/colspan
      const cellMap = buildCellMap(rows);
      
      cellMap.forEach((mappedRow, rowIndex) => {
        // Column 8 contains the descriptors (after rowspan resolution)
        // Skip rows where first cell spans entire width (header rows)
        const originalRow = rows[rowIndex];
        if (!originalRow) return;
        
        const firstCell = originalRow[0];
        if (firstCell && firstCell.colspan && firstCell.colspan >= 10) {
          return; // Skip this row - it's a full-width header
        }
        const descriptorCell = mappedRow[8];
        
        if (!descriptorCell || !descriptorCell.text) return;
        
        const text = descriptorCell.text;
        
        
        const names = {
          wei_chinese: originalRow[0]?.text || '',
          wei_english: originalRow[1]?.text || '',
          shu_chinese: originalRow[2]?.text || '',
          shu_english: originalRow[3]?.text || '',
          wu_chinese: originalRow[4]?.text || '',
          wu_english: originalRow[5]?.text || ''
        };
        
        const entryData = {
          names,
          descriptor: descriptorCell.text,
          descriptor_english: mappedRow[9]?.text || '',
          sheet: sheetName
        };
        
        const pinMatches = text.match(pinRegex);
        if (pinMatches) {
          pinMatches.forEach(pin => {
            if (!byPin[pin]) byPin[pin] = [];
            byPin[pin].push(entryData);
          });
        }
        
        const shiMatches = text.match(shiRegex);
        if (shiMatches) {
          shiMatches.forEach(shi => {
            if (!byShi[shi]) byShi[shi] = [];
            byShi[shi].push(entryData);
          });
        }
      });
    }
  });
  
  // Deduplicate entries with identical names
  function deduplicateEntries(entries) {
    const seen = new Set();
    return entries.filter(entry => {
      // Create unique key from all name fields
      const key = `${entry.names.wei_chinese}|${entry.names.wei_english}|${entry.names.shu_chinese}|${entry.names.shu_english}|${entry.names.wu_chinese}|${entry.names.wu_english}`;
      
      if (seen.has(key)) {
        return false; // Duplicate, filter out
      }
      seen.add(key);
      return true; // Keep this entry
    });
  }
  
  // Apply deduplication to all categories
  for (const pin in byPin) {
    byPin[pin] = deduplicateEntries(byPin[pin]);
  }
  
  for (const shi in byShi) {
    byShi[shi] = deduplicateEntries(byShi[shi]);
  }
  
  return { byPin, byShi };
}

// Helper function to build cell map (handles rowspan/colspan)
function buildCellMap(rows) {
  const cellMap = [];
  
  for (let r = 0; r < rows.length; r++) {
    if (!cellMap[r]) cellMap[r] = [];
    
    let visualCol = 0;
    
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c];
      
      // Skip positions already occupied by cells from above rows with rowspan
      while (cellMap[r][visualCol] !== undefined) {
        visualCol++;
      }
      
      const rowspan = cell.rowspan || 1;
      const colspan = cell.colspan || 1;
      
      // Fill all positions this cell occupies
      for (let rs = 0; rs < rowspan; rs++) {
        for (let cs = 0; cs < colspan; cs++) {
          const targetRow = r + rs;
          const targetCol = visualCol + cs;
          
          if (!cellMap[targetRow]) cellMap[targetRow] = [];
          cellMap[targetRow][targetCol] = cell;
        }
      }
      
      visualCol += colspan;
    }
  }
  
  return cellMap;
}