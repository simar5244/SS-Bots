// TCCNS Parser - reads from the Excel file and returns equivalencies
export async function loadTccnsData() {
  try {
    // Load the new TCCNS data structure
    const response = await fetch('/data/TX_equivalencies.json')
    if (!response.ok) {
      console.error('Failed to fetch TCCNS data:', response.status)
      return []
    }
    
    const data = await response.json()
    const equivalencies: any[] = []
    
    // New structure: tccnsCode -> { courseName, institutions: [{fice, name, courseCode, credits}] }
    Object.keys(data).forEach(tccnsCode => {
      // Skip header row
      if (tccnsCode === 'Common Common') return
      
      const courseData = data[tccnsCode]
      
      // Create one entry per TCCNS code showing all institution mappings
      equivalencies.push({
        id: tccnsCode.replace(/\s+/g, '-'),
        tccnsCode: tccnsCode,
        courseName: courseData.courseName || '',
        institutions: courseData.institutions || [],
        institutionCount: courseData.institutions?.length || 0,
        // For display: show sample institutions
        institutionsSummary: courseData.institutions?.slice(0, 3).map((inst: any) => 
          `${inst.name}: ${inst.courseCode}`
        ).join('; ') || ''
      })
    })
    
    console.log(`Loaded ${equivalencies.length} TCCNS courses`)
    return equivalencies
  } catch (error) {
    console.error('Error loading TCCNS data:', error)
    return []
  }
}
