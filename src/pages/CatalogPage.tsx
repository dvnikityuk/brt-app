import { memo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CatalogTab } from '../components/CatalogTab'

export const CatalogPage = memo(function CatalogPage() {
  const catalog         = useAppStore(s => s.catalog)
  const catalogWarnings = useAppStore(s => s.catalogWarnings)
  const results         = useAppStore(s => s.results)
  const setCatalog      = useAppStore(s => s.setCatalog)
  const setCatalogWarnings = useAppStore(s => s.setCatalogWarnings)

  return (
    <CatalogTab
      catalog={catalog}
      catalogWarnings={catalogWarnings}
      results={results}
      onDeleteCatalog={() => { setCatalog([]); setCatalogWarnings([]) }}
    />
  )
})
