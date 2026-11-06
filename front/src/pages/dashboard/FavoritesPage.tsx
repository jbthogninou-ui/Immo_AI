import { Link } from 'react-router-dom'
import { Heart, Search } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { PropertyCard, PropertyCardSkeleton } from '@/components/property/PropertyCard'
import { useAuth } from '@/hooks/useAuth'
import { useClientMutations, useFavorites, usePublicProperties } from '@/hooks/useQueries'

/** Biens mis de côté par le client. */
export function FavoritesPage() {
  const { user } = useAuth()
  const { data: favorites, isLoading } = useFavorites(user?.client_id)
  const { data: catalog } = usePublicProperties({ size: 100 })
  const { toggleFavorite } = useClientMutations()

  const ids = new Set((favorites?.items ?? []).map((favorite) => favorite.property_id))
  const properties = (catalog?.items ?? []).filter((property) => ids.has(property.id))

  return (
    <div>
      <PageHeader
        eyebrow="Ma recherche"
        title="Favoris"
        description="Les biens que vous avez mis de côté. Demandez une visite quand vous êtes prêt."
        actions={
          <Link to="/biens">
            <Button variant="outline" icon={<Search className="h-4 w-4" />}>Parcourir le catalogue</Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <PropertyCardSkeleton key={index} />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-8">
          <EmptyState
            title="Aucun favori"
            description="Ajoutez des biens à vos favoris depuis le catalogue pour les retrouver ici."
            icon={<Heart className="h-6 w-6" />}
            action={<Link to="/biens"><Button>Parcourir le catalogue</Button></Link>}
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              index={index}
              isFavorite
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  clientId: user!.client_id!,
                  propertyId: property.id,
                  active: true,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
