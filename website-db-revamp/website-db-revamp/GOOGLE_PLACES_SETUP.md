# 🗺️ Google Places API Integration Setup

Your website now has Google Places API integration for enhanced address entry and validation!

## ✅ What's Already Configured

1. **Environment Variables**: Your `.env` file already contains `GOOGLE_MAPS_API_KEY`
2. **Docker Configuration**: Updated to pass the API key to both frontend and backend
3. **Frontend Components**: New address input components with Google Places autocomplete
4. **Backend Services**: Google Places API service for address validation and geocoding

## 🚀 Setup Steps

### 1. Database Migration

Run the database migration to add Google Places fields to your addresses table:

```powershell
# Option 1: Direct SQL execution (easiest)
docker-compose exec -T db psql -U Enviro_svc -d Enviro_db -c "
ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_addresses_google_place_id ON addresses(google_place_id);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses(latitude, longitude);
"
```

```powershell
# Option 2: Using the migration file
Get-Content backend/app/db/migrations/0002_add_google_places_fields.sql | docker-compose exec -T db psql -U Enviro_svc -d Enviro_db
```

### 2. Restart Docker Services

Restart your containers to pick up the new environment variables:

```powershell
docker-compose down
docker-compose up -d
```

### 3. Verify Integration

1. **Frontend**: Navigate to your project dashboard and try creating a new address
2. **Google Places Autocomplete**: Should appear when typing addresses
3. **Fallback**: Manual address entry is available if Google Places fails
4. **Backend Logs**: Check for any Google Places API errors in backend logs

## 🌟 Features

### Enhanced Address Input
- **Smart Autocomplete**: Uses Google Places API for address suggestions
- **Coordinate Storage**: Automatically stores latitude/longitude for addresses
- **Validation**: Validates addresses against Google's database
- **Fallback Mode**: Works with manual entry if API is unavailable

### Used APIs (All Free Tier)
- ✅ **Geocoding API**: Convert addresses to coordinates
- ✅ **Reverse Geocoding**: Convert coordinates to addresses
- ✅ **Places Autocomplete**: Address suggestions (via Extended Component Library)

### Where It's Integrated
- 📍 **Project Dashboard**: Address creation for sample collection
- 🏢 **Company Management**: Company address entry and editing
- 🔄 **All Address Forms**: Consistent experience throughout the app

## 🛠️ Technical Details

### Frontend Environment Variable
- `VITE_GOOGLE_PLACES_API_KEY`: Used by React components for Places API

### Backend Environment Variable
- `GOOGLE_MAPS_API_KEY`: Used by backend services for geocoding

### Database Schema Changes
```sql
-- New columns added to addresses table:
formatted_address TEXT,          -- Google-formatted address string
google_place_id VARCHAR(255),    -- Unique Google Place identifier
latitude DOUBLE PRECISION,       -- Geographic latitude
longitude DOUBLE PRECISION       -- Geographic longitude
```

## 🐛 Troubleshooting

### Common Issues

**1. Autocomplete Not Working**
- Check browser console for API key errors
- Verify `VITE_GOOGLE_PLACES_API_KEY` is set in Docker environment
- Ensure Google Places API is enabled in Google Cloud Console

**2. Backend Geocoding Fails**
- Check backend logs: `docker-compose logs backend`
- Verify `GOOGLE_MAPS_API_KEY` is correctly set
- Confirm Geocoding API is enabled in Google Cloud Console

**3. Manual Address Entry**
- Click "Manual Entry" toggle if autocomplete fails
- All forms fall back gracefully to manual input
- Address validation happens on backend regardless

### Debug Commands
```powershell
# Check environment variables
docker-compose exec backend env | grep GOOGLE
docker-compose exec frontend env | grep VITE_GOOGLE

# Check database schema
docker-compose exec db psql -U Enviro_svc -d Enviro_db -c "\d addresses"

# Check backend logs
docker-compose logs backend | grep -i google
```

## 📈 Benefits

- **Better Data Quality**: Validated, standardized addresses
- **User Experience**: Fast, accurate address entry
- **Geographic Data**: Coordinates for mapping and analytics
- **Cost Effective**: Uses only free tier APIs
- **Graceful Degradation**: Works even if API is down

Your Google Places integration is now ready! 🎉