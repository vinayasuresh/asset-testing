import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layout } from "@/components/layout/layout";
import { authenticatedRequest } from "@/lib/auth";
import { useDebounce } from "@/hooks/use-debounce";
import { 
  Search, 
  Package, 
  User, 
  Building2, 
  MapPin, 
  FileText,
  Loader2,
  ArrowLeft,
  Filter,
  X
} from "lucide-react";

interface SearchResult {
  id: string;
  name: string;
  resultType: 'asset' | 'user' | 'vendor' | 'location' | 'license';
  // Asset fields
  type?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status?: string;
  location?: string;
  assignedUserName?: string;
  // User fields
  email?: string;
  role?: string;
  department?: string;
  // Vendor/Location fields
  assetCount?: number;
  // License fields
  vendor?: string;
  version?: string;
  totalLicenses?: number;
  usedLicenses?: number;
}

interface SearchResultsResponse {
  results: {
    assets?: SearchResult[];
    users?: SearchResult[];
    vendors?: SearchResult[];
    locations?: SearchResult[];
    softwareLicenses?: SearchResult[];
  };
  totalResults: number;
}

export default function SearchResults() {
  const [location, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const debouncedQuery = useDebounce(query, 300);

  // Get initial query from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const initialQuery = urlParams.get('q') || '';
    const initialType = urlParams.get('type') || 'all';
    setQuery(initialQuery);
    setSelectedType(initialType);
  }, [location]);

  // Update URL when search params change
  useEffect(() => {
    if (debouncedQuery) {
      const params = new URLSearchParams();
      params.set('q', debouncedQuery);
      if (selectedType !== 'all') {
        params.set('type', selectedType);
      }
      navigate(`/search-results?${params.toString()}`, { replace: true });
    }
  }, [debouncedQuery, selectedType, navigate]);

  // Search query
  const { data: searchResults, isLoading, error } = useQuery<SearchResultsResponse>({
    queryKey: ['/api/search', debouncedQuery, selectedType],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return null;
      
      const params = new URLSearchParams({
        query: debouncedQuery,
        type: selectedType,
        limit: '50'
      });
      
      const response = await authenticatedRequest('GET', `/api/search?${params}`);
      return response.json();
    },
    enabled: debouncedQuery.length >= 2
  });

  const handleResultClick = (result: SearchResult) => {
    // Navigate based on result type
    switch (result.resultType) {
      case 'asset':
        navigate(`/assets?search=${encodeURIComponent(result.name)}`);
        break;
      case 'user':
        navigate(`/users?search=${encodeURIComponent(result.email || result.name)}`);
        break;
      case 'license':
        navigate(`/software?search=${encodeURIComponent(result.name)}`);
        break;
      case 'vendor':
        navigate(`/assets?manufacturer=${encodeURIComponent(result.name)}`);
        break;
      case 'location':
        navigate(`/assets?location=${encodeURIComponent(result.name)}`);
        break;
      default:
        break;
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'asset': return <Package className="h-5 w-5 text-blue-500" />;
      case 'user': return <User className="h-5 w-5 text-green-500" />;
      case 'vendor': return <Building2 className="h-5 w-5 text-orange-500" />;
      case 'location': return <MapPin className="h-5 w-5 text-red-500" />;
      case 'license': return <FileText className="h-5 w-5 text-purple-500" />;
      default: return <Search className="h-5 w-5 text-gray-500" />;
    }
  };

  const getResultTypeLabel = (type: string) => {
    switch (type) {
      case 'asset': return 'Asset';
      case 'user': return 'User';
      case 'vendor': return 'Vendor';
      case 'location': return 'Location';
      case 'license': return 'License';
      default: return type;
    }
  };

  const getResultDescription = (result: SearchResult) => {
    switch (result.resultType) {
      case 'asset':
        return `${result.manufacturer || ''} ${result.model || ''} • ${result.category || ''} • ${result.status || ''}`.trim();
      case 'user':
        return `${result.email || ''} • ${result.role || ''} • ${result.department || ''}`.trim();
      case 'license':
        return `${result.vendor || ''} ${result.version || ''} • ${result.usedLicenses || 0}/${result.totalLicenses || 0} used`.trim();
      case 'vendor':
      case 'location':
        return `${result.assetCount || 0} assets`;
      default:
        return '';
    }
  };

  // Flatten search results for display
  const allResults: SearchResult[] = searchResults ? [
    ...(searchResults.results.assets || []),
    ...(searchResults.results.users || []),
    ...(searchResults.results.vendors || []),
    ...(searchResults.results.locations || []),
    ...(searchResults.results.softwareLicenses || [])
  ] : [];

  // Group results by type
  const resultsByType = allResults.reduce((acc, result) => {
    if (!acc[result.resultType]) {
      acc[result.resultType] = [];
    }
    acc[result.resultType].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <Layout 
      title="Search Results" 
      description={`${searchResults?.totalResults || 0} results found for "${query}"`}
      showAddButton={false}
    >
      <div className="flex-1 space-y-6 p-4 pt-6">
        {/* Header with Back Button and Search */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search assets, users, vendors..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              data-testid="input-search-results"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                data-testid="button-clear-search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Search Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'assets', 'users', 'licenses', 'vendors', 'locations'].map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType(type)}
              className="capitalize"
              data-testid={`filter-${type}`}
            >
              {type === 'all' ? 'All Results' : type}
            </Button>
          ))}
        </div>

        {/* Results Content */}
        {!query || query.length < 2 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground">Start searching</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter at least 2 characters to search for assets, users, vendors, and more
                </p>
              </div>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground">Search failed</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please try again or check your connection
                </p>
              </div>
            </CardContent>
          </Card>
        ) : allResults.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground">No results found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No results found for "{query}". Try different keywords or check the spelling.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Results Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search Results
                  <Badge variant="secondary" className="ml-auto">
                    {searchResults?.totalResults} results
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Results by Type */}
            {Object.entries(resultsByType).map(([type, results]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 capitalize">
                    {getResultIcon(type)}
                    {getResultTypeLabel(type)}s
                    <Badge variant="outline" className="ml-auto">
                      {results.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.map((result, index) => (
                      <div
                        key={`${result.id}-${index}`}
                        onClick={() => handleResultClick(result)}
                        className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                        data-testid={`result-${result.resultType}-${result.id}`}
                      >
                        <div className="flex-shrink-0">
                          {getResultIcon(result.resultType)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-base truncate" data-testid={`name-${result.id}`}>
                              {result.name}
                            </span>
                            <Badge variant="secondary" className="text-xs" data-testid={`type-${result.id}`}>
                              {getResultTypeLabel(result.resultType)}
                            </Badge>
                          </div>
                          {getResultDescription(result) && (
                            <p className="text-sm text-muted-foreground truncate mt-1" data-testid={`description-${result.id}`}>
                              {getResultDescription(result)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}