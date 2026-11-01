// Map a rectangular HTML monitor onto the four screen corners in the artwork.
export function perspectiveMatrix(width,height,corners) {
  const source=[[0,0],[1,0],[1,1],[0,1]],matrix=[];
  for(let i=0;i<4;i++){const [u,v]=source[i],[x,y]=corners[i];matrix.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y]);}
  for(let col=0;col<8;col++){let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];const divisor=matrix[col][col];if(Math.abs(divisor)<1e-10)throw Error('Monitor corners must form a valid quadrilateral.');
    for(let j=col;j<=8;j++)matrix[col][j]/=divisor;for(let row=0;row<8;row++){if(row===col)continue;const factor=matrix[row][col];for(let j=col;j<=8;j++)matrix[row][j]-=factor*matrix[col][j];}}
  const [a,b,c,d,e,f,g,h]=matrix.map(row=>row[8]);
  return [a/width,d/width,0,g/width,b/height,e/height,0,h/height,0,0,1,0,c,f,0,1];
}
