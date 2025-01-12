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
  Typography
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

const MapComponent = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [drawingMode, setDrawingMode] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('mission');
  const vectorSourceRef = useRef(new VectorSource());
  const drawInteractionRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Initialize map
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
        center: fromLonLat([88.8, 22.6]), // Centered on Hooghly River
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

  // Handle drawing interactions
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
      setCoordinates([]);
    });

    drawInteraction.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const coords = geometry.getCoordinates();
      
      const formattedCoords = type === 'LineString' 
        ? coords.map((coord, index) => {
            const [lon, lat] = toLonLat(coord);
            const distance = index > 0 
              ? calculateDistance(coords[index-1], coord)
              : 0;
            return { coord: [lon, lat], distance };
          })
        : coords[0].map((coord) => {
            const [lon, lat] = toLonLat(coord);
            return { coord: [lon, lat] };
          });

      setCoordinates(formattedCoords);
    });

    map.addInteraction(drawInteraction);
    drawInteractionRef.current = drawInteraction;
  };

  const calculateDistance = (coord1, coord2) => {
    const dx = coord2[0] - coord1[0];
    const dy = coord2[1] - coord1[1];
    return Math.sqrt(dx * dx + dy * dy) * 111319.9;
  };

  const handlePointMenu = (event, point) => {
    setAnchorEl(event.currentTarget);
    setSelectedPoint(point);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPoint(null);
  };

  const handlePolygonInsert = (position) => {
    setModalType('polygon');
    startDrawing('Polygon');
    handleMenuClose();
  };

  return (
    <div className="h-screen w-full relative">
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => startDrawing('LineString')}
        >
          Draw
        </Button>
      </div>
      
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

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

          <TableContainer component={Paper}>
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
                    <TableCell>
                      {point.coord[0].toFixed(8)}, {point.coord[1].toFixed(8)}
                    </TableCell>
                    <TableCell>{point.distance ? point.distance.toFixed(1) : '--'}</TableCell>
                    <TableCell>
                      <IconButton 
                        size="small"
                        onClick={(e) => handlePointMenu(e, point)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowModal(false)} color="inherit">
            Discard
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<FileDownloadIcon />}
          >
            Generate Data
          </Button>
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
    </div>
  );
};

export default MapComponent;