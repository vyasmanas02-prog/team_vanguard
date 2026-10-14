import { useState } from 'react'
import { useStore, setState, uid, notify, audit } from '../../../store.js'
import { Table } from '../../../pages.jsx'

export default function Library({ user }) {
  const s = useStore()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [bookId, setBookId] = useState('')
  const [editBookId, setEditBookId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editTotal, setEditTotal] = useState('')
  const manager = user.role === 'admin' || user.role === 'library_operator'
  const canEditSeats = user.role === 'library_operator'
  const layout = s.libraryLayout || { rows: 2, columns: 5 }
  const [layoutRows, setLayoutRows] = useState(String(layout.rows))
  const [layoutColumns, setLayoutColumns] = useState(String(layout.columns))
  const myIssues = s.libraryIssues.filter((issue) => issue.studentId === user.id)
  const myReservations = s.libraryReservations.filter((reservation) => reservation.studentId === user.id)
  const activeSeats = s.librarySeats.filter((seat) => seat.active !== false)
  const today = new Date().toISOString().slice(0, 10)
  const dueSoon = myIssues.filter((issue) => issue.status === 'issued' && issue.dueDate && issue.dueDate >= today && issue.dueDate <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10))
  const overdue = s.libraryIssues.filter((issue) => issue.status === 'issued' && issue.dueDate && issue.dueDate < today)

  const addBook = (event) => {
    event.preventDefault()
    const count = Number(quantity)
    if (!title.trim() || !author.trim() || !Number.isInteger(count) || count < 1) return
    setState((d) => {
      const book = { id: uid(), title: title.trim(), author: author.trim(), total: count, available: count }
      d.libraryBooks.push(book)
      audit(d, user.id, 'created', 'library_book', book.id, { title: book.title, copies: count })
      return d
    })
    setTitle('')
    setAuthor('')
    setQuantity('1')
  }

  const requestBook = (event) => {
    event.preventDefault()
    if (!bookId || myIssues.some((issue) => issue.bookId === bookId && ['requested', 'issued'].includes(issue.status)) || myReservations.some((reservation) => reservation.bookId === bookId && ['waiting', 'available'].includes(reservation.status))) return
    const book = s.libraryBooks.find((item) => item.id === bookId)
    if (!book) return
    setState((d) => {
      const waiting = d.libraryReservations.some((reservation) => reservation.bookId === bookId && ['waiting', 'available'].includes(reservation.status))
      if (book.available > 0 && !waiting) {
        d.libraryIssues.push({ id: uid(), bookId, bookTitle: book.title, studentId: user.id, studentName: user.name, rollNumber: user.rollNumber || user.id, date: today, status: 'requested' })
        notify(d, d.users.find((account) => account.role === 'library_operator')?.id || 'l1', `${user.name} requested ${book.title}.`)
        audit(d, user.id, 'requested', 'library_book', bookId, { title: book.title })
      } else {
        const reservation = { id: uid(), bookId, bookTitle: book.title, studentId: user.id, studentName: user.name, rollNumber: user.rollNumber || user.id, date: today, createdAt: Date.now(), status: 'waiting' }
        d.libraryReservations.push(reservation)
        notify(d, d.users.find((account) => account.role === 'library_operator')?.id || 'l1', `${user.name} joined the waitlist for ${book.title}.`)
        audit(d, user.id, 'reserved', 'library_book', bookId, { title: book.title, reservationId: reservation.id })
      }
      return d
    })
    setBookId('')
  }

  const decideIssue = (issueId, decision) => setState((d) => {
    const issue = d.libraryIssues.find((item) => item.id === issueId)
    const book = d.libraryBooks.find((item) => item.id === issue?.bookId)
    if (!issue || issue.status !== 'requested') return d
    if (decision === 'issued' && book?.available > 0) {
      issue.status = 'issued'
      const issuedOn = new Date()
      const dueOn = new Date(issuedOn)
      dueOn.setDate(dueOn.getDate() + 14)
      issue.issuedDate = issuedOn.toISOString().slice(0, 10)
      issue.dueDate = dueOn.toISOString().slice(0, 10)
      book.available -= 1
    } else {
      issue.status = 'rejected'
    }
    audit(d, user.id, decision, 'library_loan', issue.id, { studentId: issue.studentId, bookTitle: issue.bookTitle })
    return d
  })

  const returnBook = (issueId) => setState((d) => {
    const issue = d.libraryIssues.find((item) => item.id === issueId)
    const book = d.libraryBooks.find((item) => item.id === issue?.bookId)
    if (issue?.status === 'issued') {
      issue.status = 'returned'
      if (book) book.available = Math.min(book.total, book.available + 1)
      const nextReservation = d.libraryReservations
        .filter((reservation) => reservation.bookId === issue.bookId && reservation.status === 'waiting')
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0]
      if (nextReservation) {
        nextReservation.status = 'available'
        notify(d, nextReservation.studentId, `${book?.title || 'Your reserved book'} is available. Please collect it from the library.`)
      }
      audit(d, user.id, 'returned', 'library_loan', issue.id, { bookTitle: issue.bookTitle })
    }
    return d
  })

  const issueReservation = (reservationId) => setState((d) => {
    const reservation = d.libraryReservations.find((item) => item.id === reservationId)
    const book = d.libraryBooks.find((item) => item.id === reservation?.bookId)
    if (!reservation || !['waiting', 'available'].includes(reservation.status) || !book || book.available < 1) return d
    const issuedOn = new Date()
    const dueOn = new Date(issuedOn)
    dueOn.setDate(dueOn.getDate() + 14)
    book.available -= 1
    reservation.status = 'fulfilled'
    d.libraryIssues.push({
      id: uid(), bookId: book.id, bookTitle: book.title, studentId: reservation.studentId,
      studentName: reservation.studentName, rollNumber: reservation.rollNumber, date: today,
      issuedDate: issuedOn.toISOString().slice(0, 10), dueDate: dueOn.toISOString().slice(0, 10), status: 'issued',
    })
    notify(d, reservation.studentId, `${book.title} has been issued to you. Return it by ${dueOn.toISOString().slice(0, 10)}.`)
    audit(d, user.id, 'issued', 'library_reservation', reservation.id, { studentId: reservation.studentId, bookTitle: book.title, dueDate: dueOn.toISOString().slice(0, 10) })
    return d
  })

  const toggleSeat = (seatId) => setState((d) => {
    const seat = d.librarySeats.find((item) => item.id === seatId)
    if (seat && canEditSeats && seat.active !== false) {
      seat.isOccupied = !seat.isOccupied
      audit(d, user.id, seat.isOccupied ? 'occupied' : 'freed', 'library_seat', seat.id, { seatNumber: seat.seatNumber })
    }
    return d
  })

  const saveLayout = (event) => {
    event.preventDefault()
    const rows = Number(layoutRows)
    const columns = Number(layoutColumns)
    if (!canEditSeats || !Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || rows > 12 || columns < 1 || columns > 12) return
    setState((d) => {
      const previous = new Map(d.librarySeats.map((seat) => [`${seat.row}-${seat.column}`, seat]))
      d.libraryLayout = { rows, columns }
      d.librarySeats = Array.from({ length: rows * columns }, (_, index) => {
        const row = Math.floor(index / columns)
        const column = index % columns
        const seat = previous.get(`${row}-${column}`)
        return {
          id: seat?.id || `seat-${row + 1}-${column + 1}`,
          seatNumber: seat?.seatNumber || `R${row + 1}-S${column + 1}`,
          row,
          column,
          active: seat?.active ?? true,
          isOccupied: seat?.isOccupied ?? false,
        }
      })
      audit(d, user.id, 'updated', 'library_layout', 'main', { rows, columns })
      return d
    })
  }

  const toggleSeatPosition = (seatId) => setState((d) => {
    const seat = d.librarySeats.find((item) => item.id === seatId)
    if (!canEditSeats || !seat || (seat.active !== false && seat.isOccupied)) return d
    seat.active = seat.active === false
    audit(d, user.id, seat.active ? 'added_seat' : 'made_aisle', 'library_seat', seat.id, { seatNumber: seat.seatNumber })
    return d
  })

  const selectBookToEdit = (id) => {
    const book = s.libraryBooks.find((item) => item.id === id)
    setEditBookId(id)
    setEditTitle(book?.title || '')
    setEditAuthor(book?.author || '')
    setEditTotal(book ? String(book.total) : '')
  }

  const updateBook = (event) => {
    event.preventDefault()
    const total = Number(editTotal)
    if (!editBookId || !editTitle.trim() || !editAuthor.trim() || !Number.isInteger(total) || total < 1) return
    setState((d) => {
      const book = d.libraryBooks.find((item) => item.id === editBookId)
      const issued = d.libraryIssues.filter((issue) => issue.bookId === editBookId && issue.status === 'issued').length
      if (book && total >= issued) {
        Object.assign(book, { title: editTitle.trim(), author: editAuthor.trim(), total, available: total - issued })
        audit(d, user.id, 'updated', 'library_book', book.id, { title: book.title, copies: total })
      }
      return d
    })
  }

  return (
    <div>
      <h2>Library</h2>
      <h3>Book availability</h3>
      <Table head={['Title', 'Author', 'Total copies', 'Available now', 'Waiting']} rows={s.libraryBooks.map((book) => [book.title, book.author, book.total, book.available, s.libraryReservations.filter((reservation) => reservation.bookId === book.id && ['waiting', 'available'].includes(reservation.status)).length])} />

      {user.role === 'student' && dueSoon.length > 0 && <div className="warn">Due soon: {dueSoon.map((issue) => `${issue.bookTitle} by ${issue.dueDate}`).join('; ')}.</div>}
      {user.role === 'student' && myIssues.some((issue) => issue.status === 'issued' && issue.dueDate && issue.dueDate < today) && <div className="warn">Overdue: {myIssues.filter((issue) => issue.status === 'issued' && issue.dueDate && issue.dueDate < today).map((issue) => `${issue.bookTitle} was due ${issue.dueDate}`).join('; ')}.</div>}
      {manager && overdue.length > 0 && <div className="warn">{overdue.length} overdue loan{overdue.length === 1 ? '' : 's'} need follow-up.</div>}

      {user.role === 'student' && (
        <form className="card" onSubmit={requestBook}>
          <h3>Request or reserve a book</h3>
          <div className="row wrap">
            <select value={bookId} onChange={(event) => setBookId(event.target.value)} required>
              <option value="">Select a book</option>
              {s.libraryBooks.filter((book) => !myIssues.some((issue) => issue.bookId === book.id && ['requested', 'issued'].includes(issue.status)) && !myReservations.some((reservation) => reservation.bookId === book.id && ['waiting', 'available'].includes(reservation.status))).map((book) => <option key={book.id} value={book.id}>{book.title} ({book.available > 0 ? `${book.available} available` : 'join waitlist'})</option>)}
            </select>
            <button disabled={!bookId}>{s.libraryBooks.find((book) => book.id === bookId)?.available > 0 ? 'Request book' : 'Join waitlist'}</button>
          </div>
        </form>
      )}

      <section className="library-seating">
        <div className="row wrap between">
          <div>
            <h3>Library seating</h3>
            <p className="muted">{activeSeats.length - activeSeats.filter((seat) => seat.isOccupied).length} available · {activeSeats.filter((seat) => seat.isOccupied).length} occupied</p>
          </div>
          {canEditSeats && <form className="row wrap" onSubmit={saveLayout}>
            <label className="row">Rows <input aria-label="Layout rows" type="number" min="1" max="12" value={layoutRows} onChange={(event) => setLayoutRows(event.target.value)} required /></label>
            <label className="row">Columns <input aria-label="Layout columns" type="number" min="1" max="12" value={layoutColumns} onChange={(event) => setLayoutColumns(event.target.value)} required /></label>
            <button type="submit">Save layout</button>
          </form>}
        </div>
        {canEditSeats && <p className="muted">Toggle a seat to occupied or available. Use the seat/aisle control to match the floor plan.</p>}
        <div className="library-layout-wrap">
          <div className="library-layout" style={{ gridTemplateColumns: `repeat(${layout.columns}, 78px)` }}>
            {Array.from({ length: layout.rows * layout.columns }, (_, index) => {
              const row = Math.floor(index / layout.columns)
              const column = index % layout.columns
              const seat = s.librarySeats.find((item) => item.row === row && item.column === column)
              if (!seat || seat.active === false) return <div className="library-aisle" key={`aisle-${row}-${column}`}>
                <span>Aisle</span>
                {canEditSeats && seat && <button className="ghost small" onClick={() => toggleSeatPosition(seat.id)}>Add seat</button>}
              </div>
              return <div className="library-seat-cell" key={seat.id}>
                {canEditSeats ? <button className={`library-seat ${seat.isOccupied ? 'occupied' : 'available'}`} onClick={() => toggleSeat(seat.id)}>
                  <b>{seat.seatNumber}</b>
                  <span>{seat.isOccupied ? 'Occupied' : 'Available'}</span>
                </button> : <div className={`library-seat ${seat.isOccupied ? 'occupied' : 'available'}`}>
                  <b>{seat.seatNumber}</b>
                  <span>{seat.isOccupied ? 'Occupied' : 'Available'}</span>
                </div>}
                {canEditSeats && !seat.isOccupied && <button className="ghost small" onClick={() => toggleSeatPosition(seat.id)}>Make aisle</button>}
              </div>
            })}
          </div>
        </div>
      </section>

      {manager && (
        <>
          <form className="card" onSubmit={addBook}>
            <h3>Add books</h3>
            <div className="row wrap">
              <input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              <input placeholder="Author" value={author} onChange={(event) => setAuthor(event.target.value)} required />
              <input aria-label="Copies" type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
              <button>Add to inventory</button>
            </div>
          </form>
          <form className="card" onSubmit={updateBook}>
            <h3>Update book details or copy count</h3>
            <div className="row wrap">
              <select value={editBookId} onChange={(event) => selectBookToEdit(event.target.value)} required>
                <option value="">Select a book</option>
                {s.libraryBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
              </select>
              <input placeholder="Title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
              <input placeholder="Author" value={editAuthor} onChange={(event) => setEditAuthor(event.target.value)} required />
              <input aria-label="Total copies" type="number" min="1" value={editTotal} onChange={(event) => setEditTotal(event.target.value)} required />
              <button disabled={!editBookId}>Save book details</button>
            </div>
          </form>
          <h3>Requests and current issues</h3>
          <Table head={['Book', 'Student', 'Roll number', 'College', 'Department', 'Branch', 'Year', 'Class', 'Section', 'Requested', 'Issued', 'Due date', 'Status', 'Actions']} rows={s.libraryIssues.map((issue) => {
            const student = s.users.find((item) => item.id === issue.studentId)
            return [issue.bookTitle, issue.studentName, issue.rollNumber, student?.college || '', student?.dept || student?.branch || '', student?.branch || '', student?.batch || '', student ? `${student.branch} ${student.batch}` : '', student?.section || '', issue.date, issue.issuedDate || '', issue.dueDate || '', issue.status, <span className="row">
            {issue.status === 'requested' && <><button className="small" onClick={() => decideIssue(issue.id, 'issued')}>Issue</button><button className="ghost small" onClick={() => decideIssue(issue.id, 'rejected')}>Decline</button></>}
            {issue.status === 'issued' && <button className="ghost small" onClick={() => returnBook(issue.id)}>Mark returned</button>}
          </span>]
          })} />
          <h3>Book reservation waitlist</h3>
          <Table head={['Book', 'Student', 'Roll number', 'Queue status', 'Requested', 'Actions']} rows={s.libraryReservations.filter((reservation) => ['waiting', 'available'].includes(reservation.status)).map((reservation) => [reservation.bookTitle, reservation.studentName, reservation.rollNumber, reservation.status === 'available' ? 'Ready to collect' : 'Waiting', reservation.date, <button className="small" disabled={s.libraryBooks.find((book) => book.id === reservation.bookId)?.available < 1} onClick={() => issueReservation(reservation.id)}>Issue book</button>])} />
        </>
      )}

      {user.role === 'student' && <>
        <h3>My book requests and loans</h3>
        <Table head={['Book', 'Requested', 'Issued', 'Last day to return', 'Status']} rows={myIssues.map((issue) => [issue.bookTitle, issue.date, issue.issuedDate || '', issue.dueDate || '', issue.status])} />
        <h3>My reservations</h3>
        <Table head={['Book', 'Joined waitlist', 'Status']} rows={myReservations.map((reservation) => [reservation.bookTitle, reservation.date, reservation.status === 'available' ? 'Ready to collect' : reservation.status])} />
      </>}
    </div>
  )
}
