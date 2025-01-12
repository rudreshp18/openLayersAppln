import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { Draw, Modify } from 'ol/interaction';
import { fromLonLat, toLonLat } from 'ol/proj';
import { LineString, Polygon } from 'ol/geom';
import Feature from 'ol/Feature';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { set } from 'ol/transform';

const MapComponent = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [drawingMode, setDrawingMode] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [polyCoords, setPolyCoords] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('mission');
  const vectorSourceRef = useRef(new VectorSource());
  const drawInteractionRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [before, setBefore] = useState(false);

  useEffect(() => {
    const vectorLayer = new VectorLayer({
      source: vectorSourceRef.current
    });

    const initialMap = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM()
        }),
        vectorLayer
      ],
      view: new View({
        center: fromLonLat([88.8, 22.6]),
        zoom: 10
      })
    });

    setMap(initialMap);

    return () => {
      if (initialMap) {
        initialMap.setTarget(undefined);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        console.log("Enter key pressed");
        stopDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  useEffect(() => { console.log("Coordinates", coordinates, "PolyCoords", polyCoords) }, [coordinates, polyCoords]);

  const stopDrawing = () => {
    if (map && drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
      setDrawingMode(null);
    }
  };

  const handleImportPoints = () => {
    if (polyCoords.length === 0) return;

    const connectedPolyCoords = connectPolygonToLinestring(polyCoords);
    let arr = [...coordinates];

    const polygonFeature = {
      polygon: connectedPolyCoords,
      connectionIndex: before ? selectedIndex : selectedIndex + 1
    };

    before ?
      arr.splice(selectedIndex, 0, polygonFeature) :
      arr.splice(selectedIndex + 1, 0, polygonFeature);

    updateVectorSource(arr);

    setCoordinates(arr);
    setPolyCoords([]);
    setSelectedIndex(null);
    setModalType('mission');
    setShowModal(false);
  }

  const formatCoordinates = (lon, lat) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(8)}°${latDir}, ${Math.abs(lon).toFixed(8)}°${lonDir}`;
  }

  const updateVectorSource = (coords) => {
    vectorSourceRef.current.clear();

    let linePoints = [];
    coords.forEach((point, index) => {
      if (point.polygon) {
        const polygonGeom = new Polygon([point.polygon.map(p => fromLonLat(p.coord))]);
        const polygonFeature = new Feature(polygonGeom);
        vectorSourceRef.current.addFeature(polygonFeature);

        if (linePoints.length > 0) {
          const lineGeom = new LineString(linePoints);
          const lineFeature = new Feature(lineGeom);
          vectorSourceRef.current.addFeature(lineFeature);
          linePoints = [fromLonLat(point.polygon[point.polygon.length - 1].coord)];
        }
      } else {
        linePoints.push(fromLonLat(point.coord));
      }
    });

    if (linePoints.length > 1) {
      const lineGeom = new LineString(linePoints);
      const lineFeature = new Feature(lineGeom);
      vectorSourceRef.current.addFeature(lineFeature);
    }
  };

  const connectPolygonToLinestring = (polygonCoords) => {
    if (!selectedIndex && selectedIndex !== 0) return polygonCoords;

    const connectionPoint = before ?
      coordinates[selectedIndex].coord :
      coordinates[selectedIndex].coord;

    const adjustedCoords = [...polygonCoords];
    adjustedCoords[0].coord = connectionPoint;
    adjustedCoords[adjustedCoords.length - 1].coord = connectionPoint;

    return adjustedCoords.map((point, index) => ({
      ...point,
      distance: index > 0 ?
        calculateDistance(
          [point.coord[1], point.coord[0]],
          [adjustedCoords[index - 1].coord[1], adjustedCoords[index - 1].coord[0]]
        ) : 0
    }));
  };

  const startDrawing = (type) => {
    if (!map) return;

    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
    }

    setDrawingMode(type);
    setShowModal(true);
    setModalType(type === 'LineString' ? 'mission' : 'polygon');

    const drawInteraction = new Draw({
      source: vectorSourceRef.current,
      type: type
    });

    drawInteraction.on('drawstart', () => {
      // setCoordinates([]);
    });

    drawInteraction.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const coords = geometry.getCoordinates();

      const formattedCoords = type === 'LineString'
        ? coords.map((coord, index) => {
          const [lon, lat] = toLonLat(coord);
          const distance = index > 0
            ? calculateDistance([lat, lon], toLonLat(coords[index - 1]).reverse())
            : 0;
          return {
            coord: [lon, lat],
            display: formatCoordinates(lon, lat),
            distance
          };
        })
        : coords[0].map((coord, index) => {
          const [lon, lat] = toLonLat(coord);
          return {
            coord: [lon, lat],
            display: formatCoordinates(lon, lat)
          };
        });

      type === 'LineString' ? setCoordinates(formattedCoords) : setPolyCoords(formattedCoords);
    });

    map.addInteraction(drawInteraction);
    drawInteractionRef.current = drawInteraction;
  };

  const calculateDistance = (coord1, coord2) => {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;

    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const R = 6371e3;
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    return distance;
  };


  const handlePointMenu = (event, point, i) => {
    setAnchorEl(event.currentTarget);
    setSelectedPoint(point);
    setSelectedIndex(i);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPoint(null);
  };

  const handlePolygonInsert = (position) => {
    setBefore(position === 'before');
    setModalType('polygon');
    startDrawing('Polygon');
    handleMenuClose();
  };

  return (
    <div className='w-screen h-screen flex' onContextMenu={(e) => {
      e.preventDefault()
      stopDrawing()
    }}>
      <Box sx={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        '& .ol-map': {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }
      }}>
        <Box sx={{
          position: 'absolute',
          top: 30,
          left: 30,
          zIndex: 1000,
          backgroundColor: 'transparent'
        }}>
          <Button
            variant="contained"
            color="primary"
            sx={{
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0'
              },
              boxShadow: 2
            }}
            onClick={() => startDrawing('LineString')}
          >
            Draw
          </Button>
        </Box>
        {(coordinates.length > 0 || polyCoords.length > 0) && <Box sx={{
          position: 'absolute',
          top: 30,
          right: 30,
          zIndex: 1000,
          backgroundColor: 'transparent'
        }}>
          <Button
            variant="contained"
            color="primary"
            sx={{
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0'
              },
              boxShadow: 2
            }}
            onClick={() => setShowModal(true)}
          >
            Data
          </Button>
        </Box>}
        <div
          ref={mapRef}
          style={{
            width: '100vw',
            height: '100vh',
            position: 'absolute',
            padding: '20px'
          }}
          className="ol-map"
        />

        <Dialog
          open={showModal}
          onClose={() => setShowModal(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {modalType === 'mission' ? 'Mission Creation' : 'Polygon Tool'}
              <IconButton onClick={() => setShowModal(false)}>
                <CloseIcon />
              </IconButton>
            </div>
          </DialogTitle>

          <DialogContent>
            <Typography variant="subtitle1" sx={{ my: 2 }}>
              {modalType === 'mission'
                ? 'Click on the map to mark points of the route and then press ↵ to complete the route.'
                : 'Click on the map to mark points of the polygon\'s perimeter, then press ↵ to close and complete the polygon'}
            </Typography>

            {modalType === 'mission' ? <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>WP</TableCell>
                    <TableCell>Coordinates</TableCell>
                    <TableCell>Distance (m)</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {coordinates.map((point, index) => (
                    <TableRow key={index}>
                      <TableCell>{String(index).padStart(2, '0')}</TableCell>
                      {point.polygon ? <TableCell>
                        Polygon
                      </TableCell> : <TableCell>
                        {point.coord[0].toFixed(8)}, {point.coord[1].toFixed(8)}
                      </TableCell>}
                      <TableCell>{point.distance ? point.distance.toFixed(1) : '--'}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(e) => handlePointMenu(e, point, index)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer> : <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>WP</TableCell>
                    <TableCell>Coordinates</TableCell>
                    <TableCell>Distance (m)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {polyCoords.map((point, index) => (
                    <TableRow key={index}>
                      <TableCell>{String(index).padStart(2, '0')}</TableCell>
                      <TableCell>
                        {point.display}
                      </TableCell>
                      <TableCell>{point?.distance ? point?.distance.toFixed(1) : '--'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>}
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setShowModal(false)} color="inherit">
              Discard
            </Button>
            {modalType === 'mission' ? <Button
              variant="contained"
              color="primary"
            >
              Generate Data
            </Button> : <Button
              variant="contained"
              color="primary"
              onClick={() => handleImportPoints()}
            >
              Import Points
            </Button>}
          </DialogActions>
        </Dialog>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handlePolygonInsert('before')}>
            Insert Polygon Before
          </MenuItem>
          <MenuItem onClick={() => handlePolygonInsert('after')}>
            Insert Polygon After
          </MenuItem>
        </Menu>
      </Box>
    </div >
  );
};

export default MapComponent;