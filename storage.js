const StorageSystem = {
    save: (data) => {
        localStorage.setItem('catPixelData', JSON.stringify(data));
        alert("Game Saved!");
    },
    load: () => {
        const data = localStorage.getItem('catPixelData');
        return data ? JSON.parse(data) : null;
    }
};